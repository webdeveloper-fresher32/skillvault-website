# Design a URL Shortener (bit.ly-style)

You paste a long link into a form and get back `short.ly/aZ9kQ`. It looks trivial — a mapping from a short code to a long URL — and that's exactly why interviewers love it: the system itself is simple, but a good candidate is expected to reason carefully about two specific decisions (how the short code is generated, and how a wildly read-heavy workload is served) rather than hand-wave through them.

## 1. Requirements

**Functional**
- A user submits a long URL and receives a short code/URL.
- Visiting the short URL redirects (HTTP 301/302) to the original long URL.
- Optionally: custom aliases, expiration dates, click-count analytics.

**Non-functional**
- **Availability over strict consistency** — a short URL that resolves a few seconds after creation (rather than instantly) is a non-issue; a redirect service that's *down* is a real outage for every business embedding these links.
- **Latency target:** redirect lookups in single-digit milliseconds — this is on the critical path of someone else's product.
- **Scale target:** reads (redirects) vastly outnumber writes (URL creation) — often by two to three orders of magnitude, which should shape almost every architectural choice below.

## 2. Back-of-envelope estimation

Assume 100 million new short URLs created per month, and a 100:1 read-to-write ratio typical of link-shortening services:

- Writes/sec: 100,000,000 ÷ (30 × 86,400) ≈ **~39 writes/sec average** — genuinely small.
- Reads/sec (redirects): 39 × 100 ≈ **~3,900 reads/sec average**, several times higher at peak — this read load is the actual scaling target, and it's almost entirely solvable with caching (Phase 06), not database horsepower.
- Storage: a mapping row (short code, long URL, created_at, optional expiry) at ~500 bytes, 100M/month → 50GB/month ≈ **~600GB/year** — modest, and since URLs are immutable once created, this is an easy candidate for a database that never needs complex update logic, just inserts and point-lookups.
- Short-code space check: with base62 encoding (`[a-zA-Z0-9]`, 62 symbols) a 7-character code gives 62⁷ ≈ 3.5 trillion combinations — comfortably enough headroom for years of the above write volume without exhausting the space or needing longer codes.

## 3. High-level architecture

```
   Client ──create──▶┌────────────────┐
                      │  API Gateway     │  (Phase 08 L02)
   Client ──redirect─▶└────────┬───────┘
                                │
                 ┌───────────────┼────────────────┐
                 ▼                                 ▼
       ┌──────────────────┐              ┌──────────────────┐
       │  Write path         │              │  Read path (redirect) │
       │  (Shorten Service)   │              │  (Redirect Service)     │
       └────────┬───────────┘              └────────┬───────────┘
                 │                                    │
                 ▼                                    ▼
       ┌──────────────────┐              ┌──────────────────┐
       │  Postgres/Key-Val    │──async────▶│  Redis cache          │
       │  store (source of      │  populate │  (Phase 06 — nearly    │
       │  truth, short_code →   │           │  every read hits here) │
       │  long_url)              │           └──────────────────┘
       └──────────────────┘
```

- The **Shorten Service** (write path) generates the short code and persists the mapping — low volume, so it doesn't need much scaling attention beyond a normal database.
- The **Redirect Service** (read path) is where the design effort goes: it's a cache-aside lookup (Phase 06 Lesson 01) that should hit Redis for the overwhelming majority of requests, falling back to the database only on a cache miss (a brand-new or rarely-visited link).
- Because short-code-to-URL mappings are immutable once created (no update path — you delete and recreate rather than edit), there's no cache-invalidation complexity here beyond a straightforward TTL or "never expires unless the link itself expires."

## 4. Deep dive

**Short-code generation — base62 counter vs hash-based, and collision handling.** Two standard approaches, and a strong answer names the trade-off, not just one option:

- **Base62 encoding of an incrementing counter.** Maintain a globally unique, monotonically increasing integer ID (e.g., from a database sequence, or a chunk-allocation scheme where each app server reserves a range of IDs upfront to avoid hitting a shared counter on every request) and encode it in base62. This guarantees no collisions by construction — two different IDs can never encode to the same string — at the cost of needing a coordinated ID source. Codes are also sequential/guessable in creation order unless the counter is combined with a bit of shuffling, which matters if you don't want competitors easily estimating your traffic volume from code density.
- **Hash-based (e.g., take the first 7 characters of a base62-encoded MD5/SHA hash of the long URL).** No coordinated counter needed — any server can compute a code independently — but two different long URLs can hash to the same short prefix (a collision), so you need an explicit collision-check-and-retry: look up whether the generated code is already taken, and if so, either append a salt and rehash, or fall back to appending a few random characters. This trades away the "no coordination" simplicity for an occasional extra database round-trip on collision.

Most real systems lean toward the **counter-based approach with pre-allocated ID ranges** specifically because it sidesteps the collision-retry loop entirely and scales writes trivially (each app server just increments its own local counter within its pre-allocated range, occasionally requesting a new range) — worth stating explicitly as the recommendation with a one-sentence reason, rather than presenting both as equally good.

**The read-heavy cache strategy.** With reads outnumbering writes by ~100:1, the redirect lookup should almost never touch the primary database in steady state. Cache-aside (Phase 06 Lesson 01) is the natural fit: `GET short_code` from Redis; on a miss, look up Postgres, populate Redis, then redirect. Because the data is immutable, there's no delete-on-write invalidation problem to solve (Phase 06 Lesson 02) — the only expiry concern is honoring an explicit "this link expires on date X" business rule, which can be modeled as a TTL matching that expiry date rather than a fixed cache TTL. A useful follow-up an interviewer may probe: what happens on a cold cache after a deploy/restart? Answer: a brief spike of cache misses hitting the database directly, which the database can absorb because — even at 100x the write volume of this estimation — total request volume for a link-shortener is still modest compared to, say, Instagram's feed reads; this isn't a system that needs cache-warming machinery to survive a cold start.

## 5. Trade-offs / what breaks at 10x scale

- **A single counter-based ID source becomes a write bottleneck** if not pre-chunked — the fix (already folded into the recommendation above) is having each app server request and locally exhaust a range of IDs (e.g., 10,000 at a time) rather than hitting a shared counter on every single creation request.
- **A single Redis instance becomes a hot-key and capacity bottleneck** once total mapped URLs and their access frequency both grow — the fix is standard cache sharding/clustering (Redis Cluster, or consistent hashing across multiple cache nodes per Phase 04 Lesson 02) so no one node holds the entire working set.
- **Analytics (click counts) become their own scaling problem if implemented as a synchronous DB increment per redirect** — at 10x read volume this would turn the pure read path into a write-amplified one; the fix is making click tracking asynchronous (fire an event onto a queue per Phase 07, aggregate counts in a separate analytics store) so it never sits on the latency-critical redirect path.

## Interview Q&A

**Q: Would you generate short codes with a counter or a hash of the URL, and why?**
A: A counter-based approach (base62-encoding a monotonically increasing ID, with each app server pre-allocating a chunk of IDs to avoid contention) is generally preferable — it guarantees no collisions by construction and avoids the collision-check-and-retry loop that hash-based generation needs whenever two different URLs happen to hash to the same prefix.

**Q: How would you make sure the redirect lookup is fast even at high traffic?**
A: Treat it as a textbook cache-aside read path — Redis in front of the database, populated on miss — since redirects vastly outnumber creations (often 100:1+) and the underlying data is immutable, so there's no invalidation complexity beyond honoring an explicit expiry date as the cache TTL.

**Q: How do you prevent the short-code space from running out?**
A: Check the arithmetic up front: base62 encoding with even 7 characters gives 62⁷ ≈ 3.5 trillion possible codes, which comfortably outlasts realistic write volumes for years; if you ever needed more headroom, you'd simply allow an 8th character rather than needing a structural redesign.

**Q: Why use HTTP 301 vs 302 for the redirect, and does it matter for this design?**
A: A 301 (permanent redirect) lets browsers and intermediate caches remember the mapping and skip your service on repeat visits, which reduces load on you — great for pure redirect efficiency, but it also means you lose visibility into repeat-visit analytics, since the browser stops asking you. A 302 (temporary redirect) guarantees every visit hits your service, trading a bit more load for accurate click analytics — this is a legitimate design choice to surface explicitly if analytics are a stated requirement.

**Q: How would you support custom aliases (a user-chosen short code) without breaking the collision-free guarantee of the counter approach?**
A: Custom aliases go through a different, low-volume write path than the auto-generated counter path — a simple "check if this alias is already taken, insert if not, reject with a clear error if it is" — since custom-alias requests are rare and low-throughput compared to bulk auto-generated shortening, the collision-check cost here is a non-issue even though it would be too slow as the default path for millions of auto-generated codes.
