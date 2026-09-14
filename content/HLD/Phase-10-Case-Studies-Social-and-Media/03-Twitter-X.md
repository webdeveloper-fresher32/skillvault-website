# Design Twitter / X

Twitter looks like Instagram's twin — posts, follows, a home timeline — and the timeline problem really is the same fan-out trade-off. The difference that makes this a distinct case study, and a favorite follow-up question, is *trending topics*: counting what's popular across the entire platform in near real time, which Instagram's design never has to solve.

## 1. Requirements

**Functional requirements:**
- Users post short text messages ("tweets") optionally with media.
- Users follow other users and see a home timeline of tweets from people they follow, in roughly reverse-chronological order.
- Users can see currently "trending" topics/hashtags, refreshed frequently (not real time-perfect, but close).
- Users can retweet and like (counts shown, not deep-dived).

**Non-functional requirements:**
- **Read-heavy**, same shape as Instagram — timeline reads vastly outnumber tweets posted.
- **Availability over strict consistency** for the timeline (AP-leaning); trending topics tolerate being a few minutes stale.
- **Latency target:** timeline load under 500ms; trending topics refreshed every 1-5 minutes is acceptable.
- **Scale target:** design for 300 million DAU, with an extreme follower-count skew (some accounts have 100M+ followers — more extreme than Instagram's already-skewed distribution).

## 2. Back-of-envelope estimation

- DAU: 300,000,000; tweets/user/day: ~2 (most users read far more than they post)
- Tweets/day: 300M × 2 = 600,000,000 → writes/sec ≈ 600M / 86,400 ≈ **6,900 writes/sec** average, higher at peak (major events can spike this 10x+ briefly — the "everyone tweets during the game" problem)
- Timeline reads/day: assume 10 opens/day per DAU → 3,000,000,000 reads/day ≈ **35,000 reads/sec** average
- **Read:write ratio ≈ 5:1 on tweets, but the real skew is in fan-out**, not raw read:write — a single tweet from a 100M-follower account is one write that could imply 100M fan-out writes, dwarfing the aggregate numbers above.
- Trending computation: needs to count occurrences of hashtags/keywords across all 600M tweets/day, i.e. ~6,900 events/sec flowing into a counting pipeline continuously, not a batch job run once a day.
- Storage: a tweet is tiny (~300 bytes with metadata) — 600M × 300 bytes/day ≈ 180 GB/day, trivial compared to Instagram's image volume; the hard problem here is never storage size, it's fan-out and counting.

## 3. High-level architecture

```
                     ┌───────────────┐
        Post   ───► │ API Gateway    │ ◄─── Timeline / Trending request
                     └──────┬────────┘
                            │
          ┌─────────────────┼─────────────────────┐
          ▼                                       ▼
 ┌────────────────┐                     ┌────────────────────┐
 │ Tweet Service     │                     │ Timeline Service     │
 └───────┬────────┘                     └──────────┬──────────┘
         │                                          │
 ┌───────▼────────┐                     ┌───────────▼───────────┐
 │ Tweet metadata DB │                    │ Redis: precomputed timeline│  (same pattern as
 │ (sharded — Phase 05 L3)│◄───────────────│ per user (sorted list)     │   Instagram Phase 10 L2)
 └────────────────┘                     └───────────┬───────────┘
         │                                           │
 ┌───────▼────────┐                     ┌───────────▼───────────┐
 │ Fan-out Worker Queue│                    │ Trending Aggregation  │  (stream processor —
 │ (Phase 07 — async)  │                    │ Pipeline (Kafka + counters)│  conceptually
 └────────────────┘                     └────────────────────┘
```

- The **Tweet Service / Fan-out Worker / Timeline Service / Redis** stack is structurally identical to Instagram's post/fan-out/feed/Redis stack in the previous lesson — same building blocks, same celebrity problem, worse skew.
- What's new here is the **Trending Aggregation Pipeline**: every tweet is also published onto a stream (Kafka-style, Phase 07 Lesson 03's pub-sub/event-driven pattern), consumed by a counting service that tracks hashtag/keyword frequency over a sliding time window, independent of the timeline path entirely.

## 4. Deep dive

### 4.1 Timeline construction — the same fan-out trade-off, worse skew

Twitter faces the exact fan-out-on-write vs. fan-out-on-read choice from the Instagram lesson, with the celebrity problem amplified: Twitter's follower distribution has a much heavier tail (accounts with 50-100M+ followers are common), and *retweets* multiply the fan-out problem — a retweet by a huge account can inject a single tweet into tens of millions of timelines simultaneously, on top of the original author's own fan-out.

The hybrid solution is the same shape as Instagram's:

```
if poster.follower_count > CELEBRITY_THRESHOLD:
    skip fan-out-on-write; mark for pull-based merge at read time
else:
    fan out on write to each follower's precomputed timeline (Redis)

Timeline read:
    timeline = precomputed_timeline_from_redis(user)      # covers regular follows
    timeline += fetch_recent_tweets(user.celebrities_followed)  # pulled at read time
    return merge_and_sort(timeline)[:20]
```

**Explicit contrast with Instagram:** the mechanism is identical, but Twitter's threshold has to be tuned lower and the pull-path optimized harder, because (a) the tail is heavier — more accounts qualify as "celebrity" relative to the user base — and (b) retweets create a second, cascading fan-out event on top of original posts that Instagram's simpler "photo post" model doesn't have. A strong interview answer explicitly names this as "same idea as Instagram, tuned for a heavier-tailed distribution," rather than re-deriving fan-out from scratch — showing you recognize the pattern instead of treating every case study as unrelated.

### 4.2 Trending topics: counting at scale

Counting "what's popular right now" across hundreds of millions of tweets/day cannot be a single `SELECT COUNT(*) GROUP BY hashtag` — that query would need to scan a firehose in real time against a table that's being written to just as fast.

```
Tweet posted ──► published onto a stream (topic: "new_tweets")
                          │
                          ▼
              ┌────────────────────────┐
              │ Stream Consumer(s)       │
              │  extract hashtags/terms   │
              │  increment counters in a  │
              │  sliding time window       │
              │  (e.g. Redis sorted set,   │
              │   score = count, per       │
              │   5-minute bucket)         │
              └──────────┬─────────────┘
                          ▼
              Top-N query: ZREVRANGE trending:current 0 9
              → top 10 hashtags by count in the current window
```

- **Sliding window, not all-time count.** "Trending" means popular *right now*, not popular ever — old buckets are dropped/expired so a hashtag that was huge yesterday doesn't dominate today's ranking forever. This reuses the TTL/eviction idea from Phase 06 Lesson 02, applied to time-bucketed counters instead of cached objects.
- **Approximate counting is acceptable and often preferred.** At this volume, exact global counts require either a single serialization point (a bottleneck) or a distributed counter with reconciliation overhead; algorithms that trade a small, bounded error for much cheaper counting (e.g. sharded counters merged periodically, or approximate structures like Count-Min Sketch for very high-cardinality terms) are the practical answer — naming the trade-off is enough for an HLD interview; deriving the algorithm in full is not required.
- **Decoupled from the timeline path entirely** — trending computation reads the same tweet stream as everything else but never blocks or slows down tweet posting or timeline delivery, because it's a separate consumer, not a synchronous step in the write path (the same async decoupling reasoning as Phase 07 Lesson 01).

## 5. Trade-offs / what breaks at 10x scale

- **Retweet cascades** from a huge account can spike fan-out queue depth by orders of magnitude in seconds; the fix is prioritizing/rate-limiting fan-out workers per source account and leaning harder on the pull-path for any account above a (continuously re-tuned) follower threshold.
- **Trending pipeline lag** grows as tweet volume grows; if the stream consumers can't keep up with 10x the events/sec, trending topics start reflecting "popular 10 minutes ago" instead of "popular now" — the fix is horizontally scaling stream consumers (partition the stream by hashtag hash, Phase 04 Lesson 02's consistent-hashing idea applied to stream partitioning) rather than one giant consumer.
- **Timeline Redis cluster** faces the same sharding pressure as Instagram's feed cache at 10x scale, compounded by celebrity accounts' pull-path queries hammering the tweet metadata DB directly — at large scale this pushes toward a dedicated read-replica pool (Phase 05 Lesson 02) just for celebrity pull-path reads, isolated from normal write traffic.

## Interview Q&A

**Q: How is Twitter's timeline problem different from Instagram's feed problem?**
Answer: Structurally the same fan-out-on-write vs. fan-out-on-read trade-off, but Twitter's follower distribution has a heavier tail (more mega-accounts) and retweets create a second fan-out event on top of the original post, so the celebrity threshold has to be tuned more aggressively and the pull-path optimized harder than Instagram needs.

**Q: How would you compute trending hashtags without running an expensive aggregate query over the whole tweet table?**
Answer: Stream every tweet through a pub-sub pipeline to dedicated counting consumers that increment per-hashtag counters in time-bucketed windows (e.g. a Redis sorted set scored by count, reset every few minutes). Trending queries then just read the top-N of that structure — no scan of the underlying tweet store is involved.

**Q: Why use a sliding time window for trending instead of an all-time count?**
Answer: "Trending" is a proxy for "popular right now." An all-time count would be dominated by whatever went viral once, long ago, and would never reflect what's happening in the current moment — so old buckets need to expire, the same TTL-based eviction reasoning used for caches.

**Q: What happens when a massively-followed account retweets something?**
Answer: It's treated as a second post-like event from a huge account — it goes through the same celebrity/pull-path handling as an original post from that account, rather than triggering a full fan-out-on-write to tens of millions of followers.

**Q: Is exact trending-topic counting necessary, or can it be approximate?**
Answer: Approximate is not just acceptable, it's usually preferred — exact global counts at this volume require either a serialization bottleneck or expensive distributed-counter reconciliation, while an approximate count with a small bounded error is far cheaper to compute and indistinguishable to users in a "top 10 trending" list.
