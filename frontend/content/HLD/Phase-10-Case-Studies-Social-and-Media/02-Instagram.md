# Design Instagram

Instagram is two systems stapled together: a media pipeline (upload a photo, store it, serve it fast to millions) and a feed pipeline (show me the right 20 posts from the people I follow, instantly). The feed pipeline is where almost all the interesting trade-offs live.

## 1. Requirements

**Functional requirements:**
- Users can upload a photo with a caption.
- Users can follow other users.
- Users see a home feed of recent posts from people they follow, ordered roughly by recency.
- Users can like and comment on posts (counts shown, not deep-dived here).

**Non-functional requirements:**
- **Read-heavy:** feed reads vastly outnumber posts written (a typical user reads their feed far more often than they post) — this shapes every decision below toward "make reads cheap even if it costs more on writes."
- **Availability over strict consistency** for the feed — it's fine if a just-posted photo takes a few seconds to appear in a follower's feed (AP-leaning, Phase 09).
- **Latency target:** feed load in well under 500ms; image load near-instant via CDN.
- **Scale target:** design for 500 million DAU, 100 million photos uploaded/day.

## 2. Back-of-envelope estimation

- DAU: 500,000,000; average follows per user: ~200
- Photos uploaded/day: 100,000,000 → writes/sec ≈ 100M / 86,400 ≈ **1,160 writes/sec** average (bursty around peak hours, so plan for 3-5x = ~5,000/sec peak)
- Feed reads/day: assume each DAU opens the app 5 times/day and each open is one feed fetch → 500M × 5 = 2.5 billion feed reads/day ≈ **29,000 reads/sec** average, tens of thousands more at peak
- **Read:write ratio ≈ 25:1** — this single ratio is the entire justification for aggressively caching feeds and precomputing them rather than computing on every read.
- Storage: average photo ~2MB (post-compression) × 100M/day = **200 TB/day** of new image data, which is why this data lives in object storage (Phase 08 Lesson 01), never in the primary database.
- Metadata storage (post row: id, user_id, caption, image_url, created_at, ~500 bytes): 100M × 500 bytes/day ≈ 50 GB/day, ~18 TB/year — small enough to live in a normal sharded relational or NoSQL store.

## 3. High-level architecture

```
                     ┌───────────────┐
        Upload  ───► │ API Gateway    │ ◄─── Feed request
                     └──────┬────────┘
                            │
              ┌─────────────┼─────────────────┐
              ▼                               ▼
     ┌────────────────┐             ┌────────────────────┐
     │ Post Service     │             │ Feed Service         │
     └───────┬────────┘             └──────────┬──────────┘
             │                                  │
     ┌───────▼────────┐             ┌───────────▼───────────┐
     │ Object Storage   │            │ Redis: precomputed feed │  (Phase 06 — cache-aside +
     │ (S3-style, +CDN)  │            │ per user (sorted list)  │   the fan-out list below)
     └────────────────┘             └───────────┬───────────┘
             │                                  │
     ┌───────▼────────┐             ┌───────────▼───────────┐
     │ Post metadata DB │            │ Fan-out Worker Queue    │  (Phase 07 — async,
     │ (sharded by post  │◄───────────│ (on new post, push to    │   triggered on write)
     │  id — Phase 05 L3) │            │  followers' feed lists) │
     └────────────────┘             └────────────────────┘
             ▲
             │
     ┌───────┴────────┐
     │ Follow Graph DB  │  (who follows whom — read on fan-out and on-read feed assembly)
     └────────────────┘
```

- **Post Service** writes the photo to object storage and gets back a URL, then writes a metadata row (`user.profile_image` / `post.image_url` pattern from Phase 08 Lesson 01) pointing at that URL — never storing binary image data in the database.
- **CDN** sits in front of object storage so image reads never hit origin storage repeatedly for popular content.
- **Feed Service + Redis** is the payoff of the read-heavy insight above: instead of computing "posts from people I follow, sorted by time" on every request (an expensive join/scan), a per-user feed is precomputed and cached, so reading a feed is close to an O(1) Redis lookup.

## 4. Deep dive

### 4.1 Feed generation: fan-out-on-write vs. fan-out-on-read

This is the single most-asked follow-up question in this case study, because there's no universally correct answer — only a trade-off.

**Fan-out-on-write** (push model): the moment a user posts, the system immediately pushes that post into the precomputed feed of every one of their followers.

```
User posts ──► Fan-out Worker ──► for each follower F in followers(user):
                                       Redis: LPUSH feed:F  post_id
```

- Feed reads become trivially cheap: `LRANGE feed:user_id 0 19` — just read the top 20 IDs and hydrate them.
- Write cost scales with follower count: a user with 10 followers costs 10 fan-out writes; a user with 50 million followers costs 50 million writes for one post — this is where it breaks.

**Fan-out-on-read** (pull model): nothing happens at post time except writing the post. When a user opens their feed, the system fetches recent posts from everyone they follow and merges them on the fly.

```
User opens feed ──► Feed Service:
                       following = get_following(user)          # e.g. 200 people
                       posts = get_recent_posts(following)       # fan-in query/merge
                       return sorted(posts, by=created_at)[:20]
```

- Write cost is O(1) regardless of follower count — a celebrity's post is one write, full stop.
- Read cost scales with how many people you follow — a user following 5,000 accounts triggers an expensive merge on every feed open.

**The celebrity-account hybrid (the actual answer interviewers want):**

```
if poster.follower_count > CELEBRITY_THRESHOLD (e.g. 1M):
    do NOT fan out on write — too expensive
    mark post as "pull-required"
else:
    fan out on write as normal (cheap — most users have modest follower counts)

On feed read:
    feed = precomputed_feed_from_redis(user)          # fast path, fan-out-on-write results
    feed += fetch_recent_posts(user.celebrities_followed)   # slow path, merged in on read
    return merge_and_sort(feed)[:20]
```

Most users (the vast majority, by follower count distribution) get the cheap push model. The rare celebrity accounts — which would otherwise create a fan-out storm — are handled with a pull at read time, merged into the reader's otherwise-precomputed feed. This is precisely the kind of "which 80% is easy, which 20% is the actual hard problem" answer that separates a strong response from a memorized one.

### 4.2 Image storage and CDN delivery

- Original upload goes to object storage; a background job (Phase 07 pattern) generates resized variants (thumbnail, feed-size, full-size) so the client never downloads a full-resolution image just to show a small feed thumbnail.
- All image URLs are served through a **CDN** in front of object storage — the CDN caches images at edge locations close to users, so the origin store only serves a cache miss once per region, not once per view. This is the same cache-aside intuition as Phase 06 Lesson 01, just applied geographically instead of to a single Redis instance.
- Presigned URLs (Phase 08 Lesson 01) let the client upload the original photo directly to object storage, bypassing the Post Service for the large binary transfer — the Post Service only ever handles the small metadata write plus the resulting URL.

## 5. Trade-offs / what breaks at 10x scale

- **Redis feed cache size** grows linearly with users × feed length kept per user; at 10x DAU this either needs Redis Cluster sharding (Phase 05 Lesson 03's sharding idea applied to a cache) or a shorter cached feed window (only cache the most recent N posts per user, backfill older ones from the DB on scroll).
- **Fan-out worker queue backlog** — a wave of near-simultaneous popular posts (e.g. many mid-tier influencers posting around the same peak hour) can back up the fan-out queue; the fix is more worker instances (horizontal scaling, Phase 03 Lesson 01) and prioritizing celebrity-threshold tuning as follower counts grow over time.
- **Follow graph queries** for the pull-path (celebrity accounts) get slower as the average number of celebrities a user follows grows; at large scale this graph read itself needs its own cache layer or a denormalized "celebrities I follow" list per user to avoid a graph traversal on every feed load.

## Interview Q&A

**Q: What's the difference between fan-out-on-write and fan-out-on-read, and when would you use each?**
Answer: Fan-out-on-write pushes a new post into every follower's precomputed feed at post time, making reads cheap but writes expensive proportional to follower count. Fan-out-on-read does nothing at post time and assembles the feed by querying followed accounts at read time, making writes cheap but reads expensive proportional to follow count. Use write-fan-out for typical users (few followers, many reads) and read-fan-out for accounts with huge follower counts (celebrities), where fan-out-on-write would mean millions of writes per post.

**Q: Why does Instagram store images in object storage instead of the database?**
Answer: Databases (SQL or NoSQL) are optimized for structured, relatively small records with fast indexed lookups — not multi-megabyte binary blobs. Storing images as BLOBs bloats the database, slows backups/replication, and wastes an expensive, hard-to-scale resource on something object storage does more cheaply and with built-in CDN integration. The database only stores a URL pointing at the image.

**Q: How would you handle a celebrity with 100 million followers posting a photo?**
Answer: Skip fan-out-on-write for that post entirely — fanning out to 100 million feed lists would overwhelm the worker queue and Redis. Instead, mark the post for pull-based delivery: followers merge that celebrity's recent posts into their feed at read time, alongside their normal precomputed feed from regular follows.

**Q: How would you keep the feed roughly ordered by recency without re-sorting on every read?**
Answer: Use a Redis sorted set (or a simple list treated as a queue) keyed by `feed:user_id`, with new post IDs pushed to the front at fan-out time. Reading the feed is then just taking the first N elements — no sort needed at read time because the write path already maintains the order.

**Q: What happens to the feed cache if Redis restarts and loses data?**
Answer: The precomputed feed is a derived cache, not a source of truth — the underlying posts and follow graph still exist in durable storage. On a cache miss (empty feed key), the Feed Service falls back to rebuilding that user's feed via the fan-out-on-read path (or a backfill job), the same cache-aside miss-then-populate pattern from Phase 06 Lesson 01, just applied to a whole feed instead of one object.
