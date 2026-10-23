# Design a Rate Limiter

Every API you've designed so far in this course has assumed well-behaved clients. Real clients are not well-behaved: a buggy retry loop, a scraper, or a deliberate abuse attempt can send thousands of requests a second at an endpoint that was sized for tens. A rate limiter is the component that says "no" gracefully — reject or delay excess requests — before they take down the service for everyone else. It's one of the most-asked system design questions precisely because it looks like a five-minute problem ("just count requests!") and falls apart the moment you ask *where* the counter lives and what happens when two requests race to increment it at the same time.

## 1. Requirements

**Functional**
- Given a client identity (user ID, API key, or IP address) and a rule (e.g., "100 requests per minute"), allow the request if the client is under the limit, reject it (typically `HTTP 429 Too Many Requests`) if not.
- Support different limits per client tier (free vs paid) and per endpoint (a cheap `GET` vs an expensive `POST /search`).
- Optionally: tell the client how many requests they have left and when the window resets (`X-RateLimit-Remaining`, `X-RateLimit-Reset` headers).

**Non-functional**
- **The limiter must be faster than the thing it protects.** If checking the limit takes longer than just serving the request, it has defeated its own purpose — this pushes the design toward in-memory data structures (Redis) rather than a relational database on the hot path.
- **Correctness under concurrency** — the same client can have multiple requests in flight simultaneously (from multiple devices, or a burst from one), and the limiter must not let them all sneak past a shared counter due to a race condition. This is the crux of the deep dive below.
- **Availability over strict precision.** A rate limiter that occasionally lets through 101 requests instead of exactly 100 during a distributed edge case is a minor annoyance; a rate limiter that goes down and blocks *all* traffic (fail-closed) can take down the entire product it was meant to protect. Most real systems deliberately fail open (allow traffic through) if the limiter's own storage becomes unreachable.
- **Low memory footprint per client** — with millions of distinct clients (user IDs or IPs), whatever data structure tracks each client's usage needs to be small and TTL'd away automatically, not accumulate forever.

## 2. Back-of-envelope estimation

Assume an API serving 50,000 requests/sec at peak, with rate limiting applied per user ID, and roughly 5 million distinct active users in a given day:

- Rate-limiter checks/sec: **~50,000/sec** — the limiter sits on the critical path of every single request, so its own latency budget is typically sub-millisecond.
- State per user: a sliding-window-counter approach (see below) needs roughly two integers (previous window count, current window count) per user — call it ~32 bytes with key overhead. 5 million users × 32 bytes ≈ **~160MB** — trivially fits in a single Redis instance's memory, which is exactly why Redis (Phase 06 Lesson 03) rather than a database is the standard choice for limiter state.
- Redis ops/sec: each check is roughly 1-2 Redis commands (an atomic increment plus an expiry set on the first request in a window) → **~50,000-100,000 ops/sec**, comfortably within a single well-provisioned Redis instance's capacity (Redis routinely handles 100K+ ops/sec), though a heavily-trafficked API would still want clustering for headroom and failover, not just raw throughput.

## 3. High-level architecture

```
        Client
          │
          ▼
┌────────────────────┐
│    API Gateway       │  ← rate-limit check happens HERE, first
│  (Phase 08 L02)       │     (before request reaches any backend service)
└──────────┬───────────┘
           │  allowed?
           ▼
   ┌───────────────┐        ┌─────────────────────┐
   │ Rate Limiter    │◀──────▶│  Redis                │  (Phase 06 L03)
   │ (library/sidecar) │  INCR  │  key: user_id+window  │
   └───────────────┘        │  value: request count  │
           │ yes                └─────────────────────┘
           ▼
   ┌───────────────┐
   │  Backend service  │
   │  (Orders, Search,   │
   │   etc.)               │
   └───────────────┘
           │ no
           ▼
     HTTP 429
```

- The check happens at the **API Gateway** (Phase 08 Lesson 02) — the single front door every request already passes through — rather than duplicated inside every backend service. This is the same "enforce cross-cutting concerns in one place" argument the gateway lesson makes for auth: you don't want the Orders service, Search service, and Payments service each re-implementing their own rate-limit logic and each potentially getting the race-condition handling wrong in a different way.
- Redis (Phase 06 Lesson 03) holds the actual counters because it's shared across every gateway instance — if the gateway is horizontally scaled behind a load balancer (Phase 04), a client's requests can land on any gateway instance, so the counter cannot live in that instance's local memory; it needs a shared store all instances can reach, exactly like the shared session store argument in Phase 03/06.
- On a Redis outage, the gateway is configured to **fail open** (let requests through unchecked) rather than fail closed (reject everything) — a design choice worth stating explicitly, since "the rate limiter breaking becomes an outage for the whole API" is a worse failure mode than "the rate limiter briefly stops limiting."

## 4. Deep dive

### 4.1 Where the limiter lives: client-side vs API Gateway vs per-service

Three places a rate limit could be enforced, in increasing order of trustworthiness:

- **Client-side** (the mobile app or SDK throttles its own requests). Useful for being a good citizen and reducing unnecessary traffic, but it's advisory only — a malicious or just poorly-written client can ignore it entirely. Never the sole line of defense.
- **API Gateway** (the recommended default, per the architecture above). One enforcement point, applied uniformly before any backend does real work, and the natural place to also enforce different limits per API key/tier since the gateway already terminates auth (Phase 08 Lesson 03).
- **Per-service** (each backend enforces its own limit on its own inbound traffic, in addition to or instead of the gateway). Useful as defense-in-depth for a specific expensive endpoint (e.g., the Search service protecting itself from being hammered even by traffic the gateway approved), or for internal service-to-service calls that never pass through the public gateway at all. The trade-off: it means limiting logic and state now live in N places instead of one, so it should be reserved for services with a genuinely distinct concern from the general API-wide limit, not duplicated everywhere by default.

The strongest interview answer names the gateway as the primary enforcement point and explains *why* per-service limiting is sometimes layered on top, rather than treating the three as interchangeable options.

### 4.2 The four standard algorithms

**Fixed window counter.** Divide time into fixed windows (e.g., every 00:00-01:00 minute boundary), keep one counter per window, increment on each request, reject once the counter exceeds the limit. Dead simple (this is exactly the `INCR` + `EXPIRE` snippet from Phase 06 Lesson 03), but has a well-known burst problem at window boundaries: a client can send the full limit at `0:59` and the full limit again at `1:00`, getting 2x the intended rate in a two-second span, because the two windows don't overlap or know about each other.

**Sliding window log.** Store a timestamp for every individual request in a sorted set (or list) per client; on each new request, drop all timestamps older than `now - window_size`, then check if the remaining count is under the limit. This is perfectly accurate — no boundary burst problem — but the memory cost is proportional to the number of requests within the window, not a constant, which becomes expensive per-client at high request rates (a client making 10,000 requests/minute needs 10,000 stored timestamps).

**Sliding window counter.** A practical compromise: keep fixed-window counters like the first approach, but when checking the limit, take a *weighted average* of the previous window's count and the current window's count, weighted by how far into the current window you are. This approximates the sliding-log's accuracy at the fixed-window's constant memory cost (two integers per client, not one per request).

**Worked example — sliding window counter.** Limit: 100 requests/minute. Previous minute (`0:00`-`1:00`) had 80 requests. We're now at `1:15` — 25% into the current window (`1:00`-`2:00`) — and the current window already has 20 requests.

```
estimated_count = current_window_count + previous_window_count × (1 − elapsed_fraction)
                = 20 + 80 × (1 − 0.25)
                = 20 + 80 × 0.75
                = 20 + 60
                = 80
```

80 < 100, so this request is allowed. The `(1 − elapsed_fraction)` term is exactly what smooths out the boundary burst: instead of forgetting the previous window's traffic the instant the clock ticks over, its influence decays linearly as the current window fills in behind it.

**Token bucket.** A bucket holds up to `capacity` tokens (e.g., 100) and refills at a fixed rate (e.g., 10 tokens/second). Each request consumes one token; if the bucket is empty, the request is rejected. This is the only one of the four that naturally supports **bursting**: a client that's been idle can spend its entire accumulated bucket in one burst (up to `capacity` requests instantly), then falls back to the steady refill rate — a deliberate design feature, not a flaw, that matches real traffic patterns (a user loading a page fires a burst of API calls, then goes quiet).

**Worked example — token bucket.** Capacity: 100 tokens, refill rate: 10 tokens/second. Bucket currently has 30 tokens, last refilled at `t=0`. At `t=4` seconds, a request arrives:

```
tokens_to_add = elapsed_seconds × refill_rate = 4 × 10 = 40
current_tokens = min(capacity, 30 + 40) = min(100, 70) = 70
```

70 tokens available, request consumes 1, leaving 69 — allowed. If instead the bucket had been sitting at 0 tokens and only 0.05 seconds had elapsed (`tokens_to_add = 0.5`, rounds to 0), the request is rejected because there's nothing to spend yet. Note the bucket only needs to store `(current_tokens, last_refill_timestamp)` — refill amount is computed lazily on each check from elapsed time, not via a background job ticking every bucket every second.

**Leaky bucket.** The inverse framing of token bucket: requests are added to a fixed-capacity queue and processed ("leaked out") at a constant fixed rate; if the queue is full, new requests are dropped. Where token bucket allows bursts up to the bucket's capacity, leaky bucket smooths output to a strictly constant rate regardless of how bursty the input was — useful when the concern is protecting a downstream system that genuinely cannot handle *any* burst (e.g., a fixed-capacity legacy system behind the API), at the cost of legitimate bursty-but-acceptable traffic getting queued or dropped unnecessarily.

| Algorithm | Memory per client | Allows bursts? | Boundary accuracy | Typical use |
|---|---|---|---|---|
| Fixed window counter | O(1) | Yes (at boundaries — the bug) | Poor | Quick and dirty, low-stakes limits |
| Sliding window log | O(requests in window) | No | Perfect | Low-volume, high-accuracy needs |
| Sliding window counter | O(1) | Slightly smoothed | Good approximation | **Most production APIs — the default recommendation** |
| Token bucket | O(1) | Yes, up to bucket capacity (a feature) | N/A (different model) | APIs that want to allow legitimate bursts |
| Leaky bucket | O(1) + queue | No — strictly smooths | N/A (different model) | Protecting a fixed-rate downstream system |

### 4.3 Distributed rate limiting via Redis, and the race condition in a naive counter

The moment the API Gateway is horizontally scaled (multiple gateway instances behind a load balancer, per Phase 04), a client's rate-limit counter cannot live in any single gateway instance's local memory — different requests from the same client can land on different instances. This is the same shared-state problem Phase 06 Lesson 03 introduces Redis to solve for sessions, and the fix is identical in shape: store the counter in Redis, which every gateway instance reads and writes.

But a naive implementation has a genuine race condition. Picture two gateway instances handling two concurrent requests from the same user, both checking a limit of 10:

```
Instance A                          Instance B
1. GET counter → 9                  1. GET counter → 9
2. 9 < 10, allowed                  2. 9 < 10, allowed
3. SET counter → 10                 3. SET counter → 10
```

Both instances read the same value (9) before either writes back, so both conclude they're under the limit and both allow the request — the client just got 11 requests through a limit of 10, and the counter ends up at 10 instead of 11 (a lost update on top of the race). This is the classic **read-modify-write race condition**: `GET` then `SET` is two separate operations, and anything can interleave between them once there's more than one caller.

The fix is to make the check-and-increment a single atomic operation instead of two:

- **Redis `INCR`** is atomic by itself — the increment-and-return-new-value happens as one operation Redis's single-threaded execution model guarantees can't be interleaved with another client's `INCR` on the same key. The snippet from Phase 06 Lesson 03 (`count = r.incr(key)`; check `count <= limit` on the *returned* value, not a separately-fetched one) is correct precisely because it never does a separate `GET` before the decision — it decides based on the atomic increment's own return value.
- For algorithms that need more than a single increment (e.g., token bucket's "check tokens, then conditionally decrement"), the equivalent fix is a **Lua script executed atomically via `EVAL`** — Redis guarantees an entire Lua script runs without any other command interleaving, so "read current tokens, compute refill, check against request cost, write back" can all happen as one indivisible unit instead of racy separate round-trips.

Naming the race condition explicitly, and naming `INCR`'s atomicity (or a Lua script for multi-step logic) as the fix, is usually the single highest-signal thing to say in this deep dive — many candidates describe an algorithm correctly but never notice that their pseudocode has a race condition once concurrency enters the picture.

## 5. Trade-offs / what breaks at 10x scale

- **A single Redis instance becomes a bottleneck and single point of failure** once request volume is high enough — the fix is the same as any Redis scaling story (Phase 06 Lesson 03 / Phase 04 Lesson 02): shard counters across a Redis Cluster by client ID hash, and replicate for failover, accepting that a failover moment might briefly reset or lose precise counts (acceptable given the "availability over strict precision" requirement above).
- **Per-client keys and their TTLs can add up in count even though each is tiny** — at tens of millions of distinct clients, Redis's own memory overhead per key (not just the value) becomes non-trivial; the fix is favoring the sliding-window-counter's fixed O(1)-per-client footprint over the sliding-window-log's O(requests) footprint, and ensuring every key has a TTL so idle clients' state expires automatically rather than accumulating forever.
- **Cross-region deployments introduce a real consistency-vs-latency choice**: a single global Redis means every gateway instance worldwide pays cross-region round-trip latency on every request's rate check (defeating the "limiter must be fast" requirement), while per-region Redis instances mean a client hitting gateways in two regions effectively gets 2x their intended global limit (each region enforces its own local counter, unaware of the other). Most real systems accept this approximation deliberately — exact global limits are rarely worth the latency cost — which is worth stating as a conscious trade-off rather than something to "solve."

## Interview Q&A

**Q: Why is a race condition possible even with a "simple" counter-based rate limiter, and how do you fix it?**
A: Because a naive implementation does a separate `GET` (read the count) followed by a separate `SET` (write the incremented count), and two concurrent requests can both read the same pre-increment value before either writes back — both get allowed even though together they exceed the limit. The fix is making the check-and-increment one atomic operation: Redis's `INCR` is atomic by itself for simple counters, and a Lua script run via `EVAL` is the equivalent fix for multi-step logic like token bucket's check-then-decrement.

**Q: Compare token bucket and sliding window counter — when would you pick one over the other?**
A: Token bucket deliberately allows bursts up to the bucket's capacity, which matches real usage patterns like a user firing several API calls when a page loads, then going quiet — pick it when legitimate bursty traffic is expected and desirable. Sliding window counter smooths out the fixed-window boundary-burst bug at O(1) memory per client and gives a close approximation to true sliding-window accuracy — pick it as the general-purpose default when you want a steady, predictable rate without deliberately encouraging bursts.

**Q: Where should the rate limiter live — the client, the API Gateway, or each backend service?**
A: Primarily the API Gateway, since it's the one place every request already passes through, so the limit is enforced uniformly before any backend does work, and it can vary the limit per API key/tier since it already handles auth. Client-side throttling is advisory only (an untrusted client can ignore it) and per-service limiting is reserved for defense-in-depth on a specific expensive endpoint or for internal traffic that bypasses the public gateway — not a substitute for the gateway-level check.

**Q: What should happen if the Redis instance backing the rate limiter goes down?**
A: Fail open — let requests through unchecked — rather than fail closed. A rate limiter's own outage becoming an outage for the entire API it was meant to protect is a strictly worse failure mode than briefly allowing more traffic than intended; availability of the underlying service should win over strict enforcement precision.

**Q: How would you rate-limit by IP address instead of user ID, and what's the catch?**
A: Mechanically it's the same design — swap the Redis key from `user_id` to a normalized client IP. The catch is that IP-based limiting is a much blunter instrument: many real users can share one IP (behind NAT, a corporate proxy, or carrier-grade NAT on mobile networks), so a limit tuned for "one user" can wrongly throttle an entire office or cell tower's worth of legitimate traffic — worth naming as a reason to prefer authenticated-identity-based limiting (user ID or API key) wherever a client is logged in, falling back to IP only for unauthenticated traffic.
