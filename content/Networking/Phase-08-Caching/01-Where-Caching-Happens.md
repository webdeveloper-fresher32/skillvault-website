# Where Caching Happens — The Full Request Chain

## Table of Contents
1. [Why a Single Request Touches Many Caches](#1-why-a-single-request-touches-many-caches)
2. [The Full Caching Chain Diagram](#2-the-full-caching-chain-diagram)
3. [Layer by Layer](#3-layer-by-layer)
4. [Cache Hit vs Cache Miss](#4-cache-hit-vs-cache-miss)
5. [Who Controls Each Layer](#5-who-controls-each-layer)
6. [Hands-On Exercises](#6-hands-on-exercises)
7. [Interview Q&A](#7-interview-qa)

---

## 1. Why a Single Request Touches Many Caches

When you type a URL into a browser and hit Enter, that single request can be satisfied — or partially satisfied — by up to six different caches before your application's business logic ever runs. Each layer exists to answer the same question faster and cheaper than the layer behind it:

> "Do I already have a valid copy of this response? If so, skip everything downstream."

Understanding this chain matters because when something is "slow" or "stale," the bug could be in any one of these layers — not necessarily your code.

---

## 2. The Full Caching Chain Diagram

```
┌──────────────────────────────────────────────────────────────────────────┐
│  USER'S DEVICE                                                           │
│                                                                          │
│   ┌────────────────┐        ┌──────────────────────────┐               │
│   │  Browser Cache  │◀──────│  OS / Local DNS Resolver  │               │
│   │ (HTML/CSS/JS/   │       │  Cache (caches DNS         │               │
│   │  images, per    │       │  answers, e.g. 60s TTL)    │               │
│   │  Cache-Control) │       └──────────────────────────┘               │
│   └───────┬────────┘                                                    │
└───────────┼───────────────────────────────────────────────────────────┘
            │ cache miss / needs revalidation
            ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  INTERNET EDGE                                                          │
│                                                                          │
│   ┌────────────────────────────────────────────────────────┐           │
│   │  CDN Edge Cache (CloudFront, Cloudflare, Fastly, Akamai) │          │
│   │  — geographically close "point of presence" (PoP)        │          │
│   │  — caches static assets, sometimes full HTML pages       │          │
│   └───────────────────────┬────────────────────────────────┘           │
└───────────────────────────┼───────────────────────────────────────────┘
                             │ cache miss ("origin fetch")
                             ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  YOUR INFRASTRUCTURE (origin)                                           │
│                                                                          │
│   ┌────────────────────────────────────────────────────────┐           │
│   │  Reverse Proxy / Load Balancer (nginx, HAProxy, ALB)      │          │
│   │  — may cache responses, terminates TLS, routes traffic    │          │
│   └───────────────────────┬────────────────────────────────┘           │
│                            ▼                                            │
│   ┌────────────────────────────────────────────────────────┐           │
│   │  Application Server (Node.js / Express / etc.)            │          │
│   │                                                            │          │
│   │   ┌────────────────────────────────────────────────┐     │          │
│   │   │  Application Cache (Redis / in-memory)           │     │          │
│   │   │  — see NodeJS Phase-10 03-Caching-with-Redis.md  │     │          │
│   │   └───────────────────────┬────────────────────────┘     │          │
│   └───────────────────────────┼────────────────────────────┘           │
│                                ▼                                        │
│   ┌────────────────────────────────────────────────────────┐           │
│   │  Database (MySQL / MongoDB) — the "source of truth"       │          │
│   │  — may have its own internal query cache / buffer pool     │          │
│   └────────────────────────────────────────────────────────┘           │
└──────────────────────────────────────────────────────────────────────────┘
```

Every arrow going down represents a **cache miss** — the layer above didn't have a fresh answer, so it asked the layer below. The fastest, cheapest, and best possible outcome is always the topmost cache hit: the browser already has the answer and never sends a network request at all.

---

## 3. Layer by Layer

### 3.1 Browser Cache

The browser stores responses to disk/memory keyed by URL (plus some request headers like `Vary`). Governed entirely by the `Cache-Control`, `Expires`, `ETag`, and `Last-Modified` headers the server sent on a previous response (full detail in Lesson 02). This is the fastest possible "cache hit" — zero network traffic at all.

### 3.2 OS / Local Resolver Cache

Before the browser can even open a connection, it needs an IP address for the domain. Operating systems and browsers keep a **DNS cache** so repeated lookups for the same hostname don't re-query a DNS server every time. This isn't HTTP caching, but it's part of the same "avoid doing work you've already done" family, and it has its own TTL (set by the DNS record, see Phase 04).

### 3.3 CDN Edge Cache

A CDN (Content Delivery Network) runs servers ("edge nodes" or "points of presence") physically distributed around the world. When a user in Sydney requests your site hosted in `us-east-1`, the CDN's Sydney edge node can serve a cached copy instead of the request crossing the ocean to your origin server. CDNs cache based on the same `Cache-Control` headers, plus their own configuration rules (e.g. "cache all `.js`/`.css`/`.png` for 1 year regardless of origin headers"). Covered in depth in Phase 10 (CDNs and Edge Delivery).

### 3.4 Reverse Proxy / Load Balancer Cache

Software like nginx or hardware/cloud load balancers sit in front of your application servers. Besides routing traffic and terminating TLS, they can also cache responses (e.g. nginx's `proxy_cache`) — effectively acting as a private, single-datacenter CDN. Covered in Phase 09.

### 3.5 Application Cache

Inside your own application, you can cache expensive computed results — most commonly database query results — in an in-memory store like Redis. This is the layer covered by [`../../NodeJS/Phase-10-Advanced-Node/03-Caching-with-Redis.md`](../../NodeJS/Phase-10-Advanced-Node/03-Caching-with-Redis.md). This phase deliberately does **not** re-cover that ground.

### 3.6 Database

Even the database itself has internal caching (e.g. MySQL's buffer pool, MongoDB's WiredTiger cache) — RAM-resident copies of frequently accessed pages/documents so it doesn't hit disk on every read. This is usually invisible to application code and tuned at the database-configuration level.

---

## 4. Cache Hit vs Cache Miss

| Term | Meaning |
|------|---------|
| **Cache hit** | The cache had a valid copy and served it — no request to the next layer down. |
| **Cache miss** | The cache had nothing (or an expired/invalid entry) — request forwarded downstream. |
| **Hit ratio** | `hits / (hits + misses)` — the key health metric for any cache layer. A CDN with a 95% hit ratio means only 5% of requests ever reach your origin. |

```
Request timeline example (product image, cached at CDN):

First ever visitor anywhere:
  Browser → (miss) → CDN → (miss) → Origin → 200 OK, image bytes
  CDN stores a copy. Origin did real work.

Second visitor, same CDN edge, within TTL:
  Browser → (miss) → CDN → (HIT!) → 200 OK, image bytes
  Origin never touched. Fast, cheap.

Same visitor, revisits page, within browser cache TTL:
  Browser → (HIT!) → 200 OK, image bytes (from disk cache)
  Zero network traffic at all.
```

---

## 5. Who Controls Each Layer

| Layer | Who configures it | How |
|-------|-------------------|-----|
| Browser cache | You (server), indirectly | Response headers (`Cache-Control`, `ETag`, etc.) |
| DNS cache | DNS record owner + OS | `TTL` field on DNS records |
| CDN edge cache | You, via CDN dashboard/config | Cache rules, TTL overrides, purge API |
| Reverse proxy cache | You, via nginx/proxy config | `proxy_cache_valid`, cache zones |
| Application cache | You, in application code | Redis `SET ... EX <ttl>`, cache-aside pattern |
| Database cache | DBA / infra, mostly automatic | Buffer pool size, memory config |

A key interview insight: **you rarely control the client directly** — you can only send hints (headers) and trust the browser/CDN to honor them. This is why understanding the header contract (Lesson 02) is so important.

---

## 6. Hands-On Exercises

1. Run `dig google.com` twice in a row and compare the reported TTL — this is the DNS cache TTL in action.
2. Open Chrome DevTools → Network tab, visit any site, reload with normal refresh (not hard refresh). Find a request whose `Size` column says `(disk cache)` or `(memory cache)` — that's a browser cache hit.
3. Run `curl -I https://www.wikipedia.org` and look for any `X-Cache`, `Age`, `Server`, or `Via` header — many CDNs (Fastly, Varnish, Cloudflare) add these to reveal whether the response was an edge hit or miss.
4. Pick any site you use daily and sketch (on paper or in a text file) which of the six layers in this lesson's diagram you think it uses. Which layers can you verify from response headers alone?
5. Run `curl -I https://www.google.com` twice a few seconds apart and compare the `Age` header value if present — it tells you how many seconds ago the CDN/proxy fetched this response from origin.

---

## 7. Interview Q&A

**Q: List the caching layers a typical web request passes through, in order.**
Answer: Browser cache → OS/DNS resolver cache → CDN edge cache → reverse proxy/load balancer cache → application cache (e.g. Redis) → database's internal cache (e.g. buffer pool). Each layer is checked before falling through to the next; a hit at any layer stops the request from going deeper.

**Q: What is a "cache hit ratio" and why does it matter?**
Answer: It's the percentage of requests served from cache versus total requests (hits / (hits + misses)). A high hit ratio at the CDN or reverse-proxy layer means most traffic never reaches the origin server, directly reducing load, cost, and latency. It's one of the primary metrics used to evaluate whether a caching strategy is effective.

**Q: Why is a CDN edge cache useful even if your origin server is fast?**
Answer: Latency is dominated by physical distance and network hops, not just server processing time. A CDN edge node physically close to the user can respond in single-digit milliseconds, while a round trip to a distant origin server might take 100–300ms regardless of how fast that origin processes the request. CDNs also absorb traffic spikes so the origin never sees the full load.

**Q: What's the difference between the application cache (e.g. Redis) and the reverse proxy cache?**
Answer: A reverse proxy cache (e.g. nginx `proxy_cache`) stores entire HTTP responses keyed by URL/headers, completely bypassing the application for a hit — the app process never even wakes up. An application cache (Redis) is used *inside* application code, typically to cache a specific expensive computation like a database query result, and requires the app to run at least enough logic to check the cache and assemble the final response.

**Q: If a user reports seeing stale data, which layers would you check first, and why?**
Answer: Start from the layer closest to the user and work backward: browser cache (hard refresh to rule it out), then CDN (check `Age`/`X-Cache` headers or purge and retest), then reverse proxy cache, then application cache (Redis key TTL/invalidation), then database replication lag. Working outside-in is faster because the outer layers are cheaper to rule out and most staleness bugs are caused by an overly long TTL at the CDN or browser layer.

**Q: Does DNS caching count as HTTP caching?**
Answer: No — DNS caching (resolving a hostname to an IP) is a separate mechanism governed by the DNS record's TTL, not by HTTP `Cache-Control` headers. It happens before an HTTP connection is even established, but it's part of the same broader "avoid redundant network work" family of caching concepts.
