# Design a Web Crawler

A web crawler starts from a handful of seed URLs, downloads each page, extracts every link on it, and repeats — forever, across a graph with billions of nodes that keeps growing and changing underneath it. Unlike most case studies in this course, there's no single user waiting on a response; the "client" is the crawler's own next iteration. That shift changes the whole design conversation: the hard problems aren't request latency, they're graph traversal at scale (which URL to fetch next, out of billions queued), never fetching the same URL twice, not overwhelming any one website, and doing all of this across a fleet of workers that must not step on each other.

## 1. Requirements

**Functional**
- Given a set of seed URLs, discover and download all reachable pages by following links.
- Extract and store page content (for later indexing/search — out of scope for this design) and extract outbound links to feed back into the crawl.
- Respect each site's `robots.txt` — the URLs it explicitly forbids crawling, and any crawl-delay it requests.
- Avoid re-crawling the same URL repeatedly in a short window (though periodic re-crawling of already-seen pages for freshness is a real requirement — just not on every pass).

**Non-functional**
- **Scalability** — the crawl frontier (URLs known but not yet fetched) can reach billions of entries; every core data structure must be one that scales horizontally, not one bounded to fit on a single machine.
- **Politeness** — this is the requirement unique to crawlers among this course's case studies. A crawler that fetches too fast from one domain looks indistinguishable from a denial-of-service attack, gets IPs banned, and creates real problems for whoever owns that site. The design must actively throttle *per domain*, not just overall.
- **Efficiency (no wasted work)** — never fetch a URL that's already been fetched recently, and never queue a URL twice — both because it wastes crawl budget and because it wastes politeness budget against a domain that could have been used on a URL not yet seen.
- **Extensibility** — new content types (eventually PDFs, images) and new priority signals (a page's importance/PageRank-like score) should be pluggable without redesigning the frontier.

## 2. Back-of-envelope estimation

Assume a crawl target of 1 billion pages crawled per month, average page size 500KB (HTML + inline metadata, not embedded media):

- Fetches/sec: 1,000,000,000 ÷ (30 × 86,400) ≈ **~385 pages/sec average**, several times higher at peak — modest compared to a consumer-facing read path, but sustained continuously, and spread thin across millions of distinct domains rather than concentrated.
- Bandwidth: 385 pages/sec × 500KB ≈ **~190MB/sec ≈ ~1.5Gbps sustained** — a real infrastructure cost, and the reason crawler design cares about avoiding re-fetching pages that haven't changed.
- URL frontier size: assume each page averages 20 outbound links, many of which are already-seen or duplicate across pages. Even after heavy dedup, a frontier of hundreds of millions to low billions of pending URLs at any given time is realistic — far beyond what fits in one machine's memory, which is the central argument for the distributed frontier design below.
- Seen-URL set: to check "have we already crawled this?" for a target of, say, 10 billion distinct URLs ever seen, storing full URLs (~70 bytes average) would need ~700GB — this is exactly the motivating number for reaching for a Bloom filter (see deep dive) instead of storing full URLs to answer a yes/no membership question.

## 3. High-level architecture

```
   Seed URLs
      │
      ▼
┌───────────────────┐
│   URL Frontier       │  priority queue, partitioned per domain
│  (priority + politeness)│  (Kafka/queue-backed, per Phase 07)
└──────────┬───────────┘
           │ dequeue (respecting per-domain rate limit)
           ▼
┌───────────────────┐        ┌─────────────────────┐
│  Crawler Worker Pool  │───────▶│  DNS Resolver / cache  │
│  (partitioned by         │        └─────────────────────┘
│   domain hash)            │
└──────────┬───────────┘
           │ fetch page
           ▼
┌───────────────────┐
│  Downloader            │──fetched HTML──▶┌─────────────────┐
│  (respects robots.txt)  │                 │  Content Store     │  (Phase 08 L01
└──────────┬───────────┘                 │  (raw pages)        │   Object Storage)
           │ extract links                └─────────────────┘
           ▼
┌───────────────────┐
│  Link Extractor         │
└──────────┬───────────┘
           │ new URLs
           ▼
┌───────────────────┐
│  Duplicate Filter        │  Bloom filter (seen-URL check)
│  (Bloom filter + exact  │  + exact-match store for confirmation
│   store for confirmed)    │
└──────────┬───────────┘
           │ genuinely new URLs
           └──────────▶ back into URL Frontier
```

- The **URL Frontier** is the crawler's core data structure — not a simple FIFO queue, because not every pending URL is equally important (a homepage of a major news site should be revisited more often than an obscure page three links deep) and not every pending URL can be fetched right now (politeness limits how fast any one domain can be hit).
- **Crawler workers** are partitioned by domain, not assigned URLs randomly — this is what makes per-domain politeness enforceable without needing a distributed lock: if worker set assigned to `example.com` never overlaps with the worker set for any other domain, the per-domain rate limit can be enforced locally within that partition (see deep dive).
- The **Duplicate Filter** guards the frontier's entrance: before a newly-extracted link is added to the frontier, it's checked against a Bloom filter (fast, small, "probably seen" answer) backed by an exact-match store used to resolve the rare false positives and to record newly confirmed URLs.
- Fetched content lands in **object storage** (Phase 08 Lesson 01) — the same pattern as any large-blob storage need in this course — separate from the frontier's own lightweight metadata (the URL, its priority, its last-crawl timestamp).

## 4. Deep dive

### 4.1 URL frontier — priority queue + per-domain politeness

A flat single priority queue across the entire crawl has a fatal flaw: if the highest-priority URLs at any given moment happen to cluster on one domain (very plausible — a large news site publishes 50 new pages this hour, all high priority), naively draining the top of the queue would hammer that one domain continuously while every other domain waits, both violating politeness and wasting the opportunity to make progress elsewhere in parallel.

The standard fix is a **two-level frontier**:

- **Front queues** — a small number of queues bucketed by priority (e.g., "crawl again in an hour," "crawl again in a day," "crawl again in a week," derived from a page's importance/change-frequency signal). A URL is placed into the front queue matching its priority; front queues feed into the back queues below via a simple biased selector (mostly pull from high-priority front queues, occasionally pull from lower ones so nothing starves indefinitely).
- **Back queues** — one queue **per domain**. Every URL in a given back queue belongs to the same domain, so enforcing "don't fetch from `example.com` more than once every N seconds" becomes a purely local property of that one queue: attach a `next_allowed_fetch_time` to each domain's back queue, and a worker simply skips (or delays on) a queue whose time hasn't arrived yet, instead of needing any cross-worker coordination.

This is the same conceptual move as the Rate Limiter case study's per-client keying (Lesson 09) — the unit that needs a rate limit (a domain here, a user there) gets its own isolated counter/queue so that enforcing its limit never requires looking at any other unit's state.

### 4.2 Distributed crawling — partitioning workers by domain hash

With a frontier of hundreds of millions of URLs, a single crawler process cannot keep up, so the crawl is spread across many worker machines. The critical decision is **how** work is assigned to workers, because it directly determines whether the per-domain politeness scheme above actually works in a distributed setting.

Assigning URLs to workers randomly (e.g., round-robin, or "whichever worker is free next") breaks politeness: two different workers could independently pull URLs for the same domain from two different back queues at the same moment, both unaware of the other, and the domain gets hit twice as fast as intended — the exact same read-modify-write race condition class as Lesson 09's naive counter, just manifesting as "two workers both think they're allowed to fetch `example.com` right now."

The fix: **partition by consistent/deterministic hash of the domain**, not the full URL. `worker_id = hash(domain) % num_workers` (or, more robustly at scale, consistent hashing across workers per Phase 04 Lesson 02, so adding/removing a worker doesn't reshuffle every domain's assignment) guarantees every URL for a given domain always routes to the same worker. That worker can then own the domain's rate-limit state locally — no cross-worker coordination needed, because no other worker will ever try to fetch from that domain. This is precisely why the back-queue-per-domain design in 4.1 and the domain-hash worker partitioning here have to be designed together: the queue structure only delivers real per-domain isolation if the workers pulling from it are partitioned the same way.

A secondary benefit: partitioning by domain also gives good **DNS cache locality** — a worker that only ever talks to a fixed subset of domains can keep a warm local DNS cache instead of every worker resolving every domain cold.

### 4.3 Duplicate URL detection at scale — the Bloom filter

Every extracted link needs a "have we already crawled (or already queued) this URL?" check before it's added to the frontier, and this check happens *extremely* often — every single link on every single page, at hundreds of fetches/sec times ~20 links/page. Storing every seen URL in a normal hash set or database, keyed by the full URL string, works correctly but costs real memory/storage at billions of entries (the ~700GB estimate above) and a database round-trip per check adds real latency at this call volume.

A **Bloom filter** trades a small, tunable false-positive rate for a dramatic space reduction: instead of storing URLs themselves, it's a fixed-size bit array plus several hash functions. Adding a URL sets several bits (its hash outputs mod array size); checking a URL reads those same bit positions — if *any* is 0, the URL is definitely new; if *all* are 1, the URL is *probably* already seen (it could be a false positive from bit collisions with other URLs, but never a false negative). This is the correctness property that makes it safe to use here: a Bloom filter will never wrongly tell you a truly-new URL is a duplicate, so it can never cause a page to be silently skipped — it can only occasionally cause an already-seen URL to be double-checked against the slower exact store.

At billions of entries, a Bloom filter sized for a ~1% false-positive rate needs only a few bits per entry (versus tens of bytes per full URL) — typically a couple of gigabytes for a multi-billion-URL set, small enough to keep entirely in memory on each crawler worker (or sharded across a small cluster), versus the hundreds of gigabytes a full-URL set would need. The practical design: check the Bloom filter first (fast, in-memory, the overwhelming majority of checks stop here); only on a "probably seen" hit, confirm against a smaller exact-match store (a key-value store of confirmed URLs) to rule out the rare false positive before deciding to actually skip the URL.

### 4.4 robots.txt and politeness

Before crawling any page on a domain, a compliant crawler fetches and caches that domain's `/robots.txt`, which specifies disallowed paths (`Disallow: /admin/`) and, informally, a requested crawl delay. This is fetched once per domain and cached with its own TTL (re-checked periodically, since a site can change its policy) rather than being fetched before every single page — fetching `robots.txt` on every request would itself be an impoliteness problem. Respecting it isn't just etiquette: ignoring it is how crawlers get entire IP ranges blocked, which would take down every other, well-behaved crawl job sharing that infrastructure. Politeness in general — the per-domain rate limit already threaded through 4.1 and 4.2 — is what keeps a webmaster's server from mistaking your crawler for an attack; explicitly naming both robots.txt compliance and a sensible default crawl delay (used when a site's `robots.txt` doesn't specify one) is worth stating even if the interviewer doesn't probe for it, since it's easy to design a crawler that "works" while accidentally being a bad citizen of the web.

## 5. Trade-offs / what breaks at 10x scale

- **Domain-hash partitioning can create hot workers when one domain is disproportionately large** — a domain with tens of millions of pages funnels entirely onto one worker (or one worker's queue) under naive `hash(domain) % N`, starving that worker while others idle. The fix is sub-partitioning very large domains by URL path prefix while still keeping politeness enforcement scoped to the whole domain (a shared rate-limit counter across that domain's sub-partitions, back to the same Redis-backed atomic-counter pattern from Lesson 09).
- **The Bloom filter's false-positive rate creeps up as the true entry count grows past what the filter was sized for** — a filter sized for 1 billion URLs starts producing more false positives once 5 billion have been inserted, silently increasing the rate of unnecessary exact-store lookups (a performance problem, not a correctness one, since false positives never cause missed crawls). The fix is either provisioning generous headroom upfront or migrating to a layered/scalable Bloom filter variant that can grow.
- **Content freshness becomes its own re-crawl scheduling problem at scale** — treating "crawled once" as "done forever" means a 10x-larger web has 10x more stale pages; the front-queue priority scheme in 4.1 needs a real re-crawl policy (estimate each page's change frequency from observed history, prioritize frequently-changing pages like news homepages far above static ones) rather than a one-time frontier that drains and stops.

## Interview Q&A

**Q: How would you make sure the crawler doesn't hammer any single website too hard?**
A: Partition both the frontier's back queues and the crawler workers themselves by domain (via a hash of the domain, ideally consistent hashing so worker changes don't reshuffle every domain), so every URL for a given domain always routes to the same worker and queue. That worker can then enforce a per-domain rate limit purely locally — attach a "next allowed fetch time" to the domain's queue — because no other worker will ever try to fetch from that domain concurrently, which is what avoids needing distributed coordination for the rate limit itself.

**Q: How do you avoid crawling the same URL twice at billions of URLs, without storing every URL in full?**
A: A Bloom filter — a fixed-size bit array checked via several hash functions — answers "have we seen this?" in a few bits per entry instead of tens of bytes per full URL, at the cost of an occasional false positive (never a false negative), so a "probably seen" hit gets confirmed against a smaller exact-match store before actually being skipped. This keeps the seen-set small enough to fit in memory even at multi-billion-URL scale.

**Q: Why not use a single global priority queue for the whole frontier?**
A: Because a flat priority queue would let the highest-priority URLs cluster on one domain and get drained continuously, both violating per-domain politeness and starving progress on every other domain. The fix is a two-level frontier — priority-bucketed front queues feeding into per-domain back queues — so priority ordering and per-domain rate limiting are handled by two separate, cooperating structures instead of one queue trying to do both jobs at once.

**Q: What would you do if a page's content hasn't changed since the last crawl — do you still store and re-index it?**
A: Compare a hash (or the HTTP `ETag`/`Last-Modified` header) of the fetched content against what was stored last time; if unchanged, skip re-storing/re-indexing and just update the "last checked" timestamp used to schedule the next re-crawl. This avoids wasting storage and downstream indexing work on pages that are being re-crawled purely for freshness-checking purposes rather than because they actually changed.

**Q: How does this design change if you need to crawl the same domain from multiple worker fleets in different regions for latency reasons?**
A: The per-domain rate limit state (the "next allowed fetch time") has to move from worker-local memory to a shared store all fleets can check — the same shift Lesson 09 makes for a horizontally scaled rate limiter — otherwise two regions independently believe they're each allowed to fetch at the full rate and together double the effective politeness violation against that domain.
