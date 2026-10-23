# Eviction and Invalidation

A cache lives in RAM, and RAM is finite and expensive — you can't just cache everything forever. Two questions follow immediately: when the cache fills up, what gets thrown away to make room (**eviction**)? And when the underlying data changes, how does the cache find out its copy is now wrong (**invalidation**)? Get either one wrong and you either waste memory on data nobody wants, or — much worse — confidently serve a user data that's flat-out incorrect.

## Eviction: What Gets Thrown Away When the Cache Is Full

Three common policies:

- **LRU (Least Recently Used)** — evict whatever hasn't been *accessed* in the longest time. Assumes: if you haven't been asked for in a while, you probably won't be asked for again soon.
- **LFU (Least Frequently Used)** — evict whatever has been accessed the *fewest total times*. Assumes: raw popularity matters more than recency.
- **TTL (Time To Live)** — every key gets an expiry timestamp when it's written; once that time passes, the key is deleted regardless of how popular it is.

Redis supports all three (`maxmemory-policy allkeys-lru`, `allkeys-lfu`, and per-key `EX` for TTL), and real systems often combine them: a TTL as a safety net so nothing lives forever, plus LRU eviction if memory pressure forces early evictions before TTLs expire.

### Worked Example: LRU on a 3-Slot Cache

Say the cache can only hold 3 keys. Requests come in for `A`, `B`, `C`, then `A` again, then `D`:

```
Access:  A         B         C         A (again)     D
Cache:  [A]      [A,B]    [A,B,C]    [B,C,A]*     [C,A,D]
                                          ▲              ▲
                              A moves to "most recent"   B evicted (was least
                              (it was just accessed)      recently used)
```

When `A` is re-accessed, it moves to the "most recently used" end — so when `D` arrives and the cache is full, `B` (untouched since the very first round) is the least recently used, and it's the one evicted, not `A` or `C`.

## Invalidation: How the Cache Learns Data Changed

Eviction handles *running out of room*. Invalidation handles a different problem: the cached value is still sitting there, plenty of room left, but the database has since changed underneath it. Two common strategies:

- **TTL expiry** — set every cached value to expire after N seconds (as in Lesson 01's `r.set(cache_key, user, ex=300)`). Simple, but for up to those 300 seconds, the cache can serve a stale value.
- **Explicit delete-on-write** — whenever the application writes to the database, it also deletes (or updates) the corresponding cache key, so the *next* read is forced to be a miss and re-fetch the fresh value.

```python
def update_user_email(user_id: int, new_email: str):
    update_user_in_db(user_id, new_email)   # 1. write to source of truth
    r.delete(f"user:{user_id}")             # 2. invalidate the stale cache entry
```

### The Classic Bug: Stale Cache After a DB Update

This is the bug nearly every backend engineer writes at least once:

```
1. Request reads user:10 → cache MISS → reads DB → caches {"name": "Asha"} with TTL 5 min
2. 10 seconds later: admin updates user 10's name to "Asha K." directly in the DB
   (forgets to invalidate the cache — or the update code path never even calls r.delete)
3. For the next ~4 min 50 sec, every read of user:10 returns the CACHED, now-WRONG "Asha"
```

Nothing crashes. No error is logged. The system just quietly serves incorrect data until the TTL runs out — which is exactly why this bug is so easy to ship and so annoying to debug in production. The fix is discipline, not cleverness: **every code path that writes to a row must also invalidate (or update) that row's cache entry**, and TTLs should be treated as a backstop for bugs, not as the primary invalidation mechanism.

## Interview Q&A

**Q: What's the difference between cache eviction and cache invalidation?**
Answer: Eviction is about reclaiming memory — removing entries to make room for new ones when the cache is full, based on a policy like LRU or LFU. Invalidation is about correctness — removing or refreshing an entry because the underlying data changed, regardless of whether the cache is full. A cache can have plenty of free memory and still serve wrong data if invalidation isn't handled.

**Q: How does LRU eviction work, and why is it a common default?**
Answer: LRU evicts the entry that hasn't been accessed for the longest time, on the assumption that recent access is the best predictor of near-future access. It's a common default because it's cheap to implement (a doubly linked list plus a hash map gives O(1) access and eviction) and works well for the "hot data stays hot" pattern most real caches see — profiles, product pages, and feed data are read in bursts, not uniformly.

**Q: What causes the "stale cache after a DB update" bug, and how do you prevent it?**
Answer: It happens when a write path updates the database but doesn't also invalidate the corresponding cache key, so the cache keeps serving the pre-update value until its TTL expires. The fix is to make cache invalidation part of every write operation — typically a `DELETE` on the cache key right after (or in the same transaction context as) the database write — and to treat TTLs as a safety net rather than the primary way stale data gets cleared.

**Q: Would you rather rely purely on TTL expiry or purely on explicit invalidation, and why?**
Answer: Neither alone is ideal — pure TTL means data can be wrong for up to the full TTL window after every write, and pure explicit invalidation means a single missed code path (or a write that happens outside the normal application, like a manual DB fix) leaves stale data cached forever with no backstop. In practice you want both: explicit delete-on-write for the common case, plus a TTL as insurance against any invalidation you forgot or any out-of-band write.

**Q: If a cache is configured with `allkeys-lru` and is constantly full, what does that tell you about your cache size relative to your working set?**
Answer: It means your working set (the data actually being accessed regularly) is larger than the cache's available memory, so the cache is thrashing — evicting and re-fetching data that's still being actively used, rather than only evicting genuinely cold data. The fix is usually to increase the cache's memory allocation, shard the cache across more nodes, or cache more selectively (only the highest-value keys) rather than trying to cache everything.
