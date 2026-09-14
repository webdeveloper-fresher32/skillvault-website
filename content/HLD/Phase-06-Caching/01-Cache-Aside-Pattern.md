# Cache-Aside Pattern

Imagine `user:10`'s profile gets fetched 10,000 times a minute — once every time anyone views their profile, sees their name on a comment, or opens a chat with them. Every one of those 10,000 requests hitting Postgres to run the exact same `SELECT * FROM users WHERE id = 10` is pure waste: the row hasn't changed since the last read. What if the first request paid the cost of asking the database, and every request after that — until something actually changes — got the answer from memory instead?

That's the entire idea behind caching. The specific way most backends implement it is called **cache-aside**.

## The Flow

```
                 ┌─────────────┐
   Request       │             │   HIT (data found)
  ─────────────▶ │    Redis    │───────────────────▶  Return to caller
  GET user:10    │   (cache)   │
                 └──────┬──────┘
                        │ MISS (not found)
                        ▼
                 ┌─────────────┐
                 │  Database   │
                 │ (Postgres)  │
                 └──────┬──────┘
                        │
                        ▼
              Store result in Redis
              (so the NEXT request is a HIT)
                        │
                        ▼
                 Return to caller
```

The application always asks the cache first. On a **hit**, it returns immediately — no database involved. On a **miss**, the application itself is responsible for going to the database, then writing the result back into the cache before returning. The cache never talks to the database on its own; it just sits "aside" the normal read path, waiting to be checked. That's where the name comes from.

## The Code

```python
import redis

r = redis.Redis()

def get_user(user_id: int):
    cache_key = f"user:{user_id}"
    user = r.get(cache_key)

    if not user:
        user = get_user_from_db(user_id)   # the expensive path
        r.set(cache_key, user, ex=300)      # populate cache, expire in 5 min
    return user
```

Three steps, every time: **check** the cache, **fall back** to the database on a miss, **populate** the cache so the next reader gets a hit. This is the single most common caching pattern you'll write in a real backend, and it's exactly the pattern the `HLD/Projects/` Instagram-backend track adds to the feed endpoint in a later stage.

## Cache-Aside vs. Write-Through

Cache-aside is a **read-side** strategy — the cache is only ever populated lazily, in reaction to a miss. There's an alternative, **write-through** caching, where the cache is updated proactively at write time, in the same operation that writes to the database:

```
Write-through:  App writes to DB  ──▶  App also writes to cache  (always, on every write)

Cache-aside:    App writes to DB  ──▶  (cache untouched — updated later, on next read-miss,
                                          or explicitly invalidated — see Lesson 02)
```

Write-through guarantees the cache is never stale immediately after a write, but it pays a cost on *every* write, even for data nobody reads again for hours. Cache-aside pays nothing extra on writes and only warms the cache for data that's actually being read — which is why it's the default choice for most read-heavy workloads (profiles, feeds, product pages), while write-through shows up more in systems where staleness right after a write is unacceptable.

## Formal Definition

**Cache-aside** (also called **lazy loading**) is a caching pattern where the application code is responsible for checking the cache before a data access, and — on a miss — reading from the source of truth (usually a database) and explicitly writing the result into the cache for future reads. The cache is a passive store that the application manages; it never independently fetches or refreshes data.

## Interview Q&A

**Q: What is the cache-aside pattern, and why is it the most common caching strategy?**
Answer: Cache-aside means the application checks the cache first; on a hit it returns the cached value, and on a miss it reads from the database and populates the cache for next time. It's the most common pattern because it only caches data that is actually being requested (no wasted cache space on unread data) and adds zero overhead to writes — the trade-off is that the very first read after a miss (or after data changes) always pays the full database cost.

**Q: What happens on the very first request for a key that's never been cached?**
Answer: It's a guaranteed cache miss — the cache is checked, found empty, and the application falls through to the database, then writes the result into the cache. This is sometimes called a "cold cache" and is why some systems pre-warm frequently-accessed keys after a deploy or cache flush, rather than letting every key start cold.

**Q: What's the difference between cache-aside and write-through caching?**
Answer: Cache-aside only touches the cache on reads (lazily, after a miss); write-through updates the cache synchronously on every write, alongside the database write. Cache-aside is cheaper for write-heavy or rarely-read data since it never caches something nobody asked for; write-through is safer when you can't tolerate any staleness immediately after a write, at the cost of paying a cache-write on every write regardless of whether that data is ever read again.

**Q: What happens if Redis is down when a cache-aside application tries to read?**
Answer: A well-written cache-aside client treats the cache as optional infrastructure — if the `GET` call to Redis fails or times out, the application should catch that and fall through to the database directly, rather than raising an error to the caller. The application stays correct (just slower) with the cache unavailable; the cache should never become a single point of failure for correctness, only for performance.

**Q: Does the cache-aside pattern guarantee the cached value is always up to date?**
Answer: No — it only guarantees the value was correct at the moment it was written into the cache. If the underlying row changes in the database afterward, the cache will keep serving the old value until it expires (TTL) or is explicitly invalidated. Handling that staleness is the entire subject of the next lesson.
