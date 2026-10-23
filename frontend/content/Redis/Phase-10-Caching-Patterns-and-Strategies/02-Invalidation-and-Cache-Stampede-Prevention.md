# 02 — Invalidation and Cache Stampede Prevention

> A comprehensive reference covering how to keep cached data from going stale, and how to stop a huge number of clients from hammering the database simultaneously the moment a hot cache key expires.

---

## Table of Contents

1. [The Problem: Stale Data and Cache Stampedes](#1-the-problem-stale-data-and-cache-stampedes)
2. [The Analogy: The Rush on the Newly Opened Checkout Lane](#2-the-analogy-the-rush-on-the-newly-opened-checkout-lane)
3. [Cache Invalidation Strategies](#3-cache-invalidation-strategies)
4. [Cache Stampede Prevention](#4-cache-stampede-prevention)
5. [Common Mistakes and Interview Angle](#5-common-mistakes-and-interview-angle)
6. [Hands-On Exercises](#6-hands-on-exercises)
7. [Interview Q&A](#7-interview-qa)

---

## 1. The Problem: Stale Data and Cache Stampedes

There's an old programming joke: "there are only two hard things in computer science: cache invalidation and naming things." It's a joke because it's true — invalidation is genuinely hard, and getting it wrong causes two very different, very real production incidents:

- **Stale data:** a cached value stops matching reality (a price changed, a profile was updated, an item went out of stock) but the cache doesn't know that yet, and keeps confidently serving the old answer until something tells it otherwise.
- **Cache stampede (also called a "thundering herd"):** a popular cache key expires, and in the split second before anything repopulates it, every single one of the thousands of requests currently in flight sees a miss *at the same time* — and every one of them independently goes to the database to fetch the same answer, all at once. The database, which the cache existed specifically to protect, suddenly gets hit with a spike of duplicate, simultaneous load it was never sized for.

The first problem is about *correctness* — is the value even right? The second is about *load* — even if regenerating the value is cheap for one request, doing it 10,000 times simultaneously for the exact same key is not. Both need deliberate handling; neither goes away just because you're "using a cache."

---

## 2. The Analogy: The Rush on the Newly Opened Checkout Lane

**Real-world analogy:** imagine a store with one checkout lane that's been closed for a break, with a "closed" sign and a small crowd of customers waiting nearby. The instant the sign comes down, everyone who was waiting rushes the lane at once — not because the store did anything wrong, but because a large number of people were all waiting for the exact same signal to act, and nothing staggered them.

**A cache stampede is exactly that rush, except the "lane" is your database and the "sign coming down" is a hot cache key expiring.** The fix in the real world is usually some form of staggering — letting people trickle in a few at a time instead of all at once, or having one designated person go first while everyone else waits briefly. The Redis-side techniques in this lesson (jittered TTLs, locking, early recomputation) are the same idea applied to cache repopulation.

---

## 3. Cache Invalidation Strategies

**Internal flow:** there are three common ways to make sure a cache doesn't keep serving data that's gone stale:

1. **TTL-based expiration** — every cached value is written with an expiration time (`SET key value EX seconds`), so even if nothing ever explicitly invalidates it, it can't live forever. This is the simplest strategy and the one you should almost always have as a baseline, even alongside the other two.
2. **Explicit invalidation on write** — when the application writes new data to the database, it also explicitly `DEL`s (or updates) the corresponding cache key, so the very next read is guaranteed to see fresh data rather than waiting out a TTL.
3. **Versioned or hash-based cache keys** — instead of invalidating a key, you change *which* key the application looks up (e.g. `product:123:v7` instead of `product:123`, bumping the version whenever the underlying data changes). Old versions simply stop being referenced and eventually expire on their own TTL — there's no race to "delete the old value before someone reads it," because nothing reads the old key anymore.

**Code example** — explicit invalidation on write, layered on top of the cache-aside pattern from the previous lesson:

```python
import redis
import json

r = redis.Redis(host="localhost", port=6379, decode_responses=True)

def update_product_price(product_id: str, new_price: float) -> None:
    # 1. write the new price to the database (simulated here)
    save_price_to_db(product_id, new_price)
    # 2. explicitly invalidate the cached entry so the next read is fresh
    r.delete(f"product:{product_id}")
```

`r.delete(key)` returns the number of keys actually removed (`1` if the key existed, `0` if it didn't) — either way, the next `get_product` call will see a cache miss and repopulate from the now-updated database.

**Common mistakes:**
- Relying on TTL alone for data where staleness actually matters (a price, an account balance) — with only TTL, changes can take up to the full TTL duration to become visible.
- Relying on explicit invalidation alone with no TTL as a backstop — if even one write path forgets to invalidate, that cache entry is stale forever with nothing to eventually expire it.

---

## 4. Cache Stampede Prevention

**Internal flow:** three complementary techniques reduce or eliminate the "everyone rushes the database at once" problem:

- **Jittered TTLs** — instead of giving every cache entry the exact same round-number TTL (e.g. `3600` seconds for everything), add a small random offset (e.g. `3600 + random.randint(0, 300)` seconds). This spreads expirations out over a window instead of all landing at the exact same instant, so keys that were all set around the same time don't all expire — and get missed — simultaneously.
- **A distributed lock for repopulation** — when a hot key misses, instead of letting every waiting request independently query the database, have only *one* request acquire a short-lived lock and do the actual repopulation, while the others either wait briefly and retry the cache, or serve a slightly-stale value if one's available.
- **Probabilistic early expiration** — recompute a cache entry's value slightly *before* its actual expiry, with the probability of doing so increasing as the expiry approaches (weighted more aggressively for entries that are expensive to recompute) — so a hot key is refreshed by a single "early" request well before it ever has the chance to fully expire and be missed by a flood of others.

**Code example** — using `SET key value NX EX ttl` as a short-lived lock so only one client repopulates an expensive, hot cache entry:

```python
import redis
import json
import time

r = redis.Redis(host="localhost", port=6379, decode_responses=True)

def expensive_recompute(product_id: str) -> dict:
    """Simulates an expensive query — e.g. an aggregation across many rows."""
    time.sleep(1.5)
    return {"product_id": product_id, "price": 42.00}

def get_product_with_stampede_guard(product_id: str) -> dict:
    cache_key = f"product:{product_id}"
    lock_key = f"lock:{cache_key}"

    cached = r.get(cache_key)
    if cached is not None:
        return json.loads(cached)

    # cache miss — try to become the single client that repopulates this key
    got_lock = r.set(lock_key, "1", nx=True, ex=10)
    # SET ... NX EX 10 returns True if this client acquired the lock,
    # or None if another client already holds it (the NX condition failed)

    if got_lock:
        try:
            fresh = expensive_recompute(product_id)
            r.set(cache_key, json.dumps(fresh), ex=300)
            return fresh
        finally:
            r.delete(lock_key)   # release the lock once repopulation is done
    else:
        # another client is already repopulating — wait briefly and retry the cache
        time.sleep(0.05)
        cached = r.get(cache_key)
        if cached is not None:
            return json.loads(cached)
        # still nothing cached yet — as a last resort, do the work ourselves
        return expensive_recompute(product_id)
```

`r.set(lock_key, "1", nx=True, ex=10)` maps directly to the Redis command `SET lock:product:123 1 NX EX 10` — it only sets the key (and returns `True` in `redis-py`) if `lock:product:123` doesn't already exist, and it returns `None` if the key was already present, meaning another client currently holds the lock. The `EX 10` is a safety net: even if this client crashes right after acquiring the lock and never reaches the `finally` block's `r.delete(lock_key)`, the lock still expires on its own after 10 seconds instead of blocking repopulation forever.

---

## 5. Common Mistakes and Interview Angle

**Common mistakes:**
- Setting every cache entry's TTL to the exact same round number (`3600`, `86400`) across a large batch of keys created around the same time — this guarantees they all expire together and virtually guarantees a stampede at that exact moment, which jittered TTLs exist specifically to avoid.
- Acquiring a stampede-prevention lock without an expiration on the lock key itself — if the client holding the lock crashes before explicitly releasing it, the lock never gets released, and no client will ever be allowed to repopulate that key again.

**Interview angle:** "How would you prevent a cache stampede on a hot key?" is a common follow-up once a candidate has correctly explained cache-aside. A strong answer names at least two distinct techniques — typically a short-lived `SET ... NX EX` lock so only one client repopulates, and jittered TTLs so a batch of keys doesn't all expire in the same instant — and explains *why* naive cache-aside alone doesn't protect against this: cache-aside says what happens on a single miss, but says nothing about what happens when thousands of misses happen at once for the same key.

---

## 6. Hands-On Exercises

### Exercise 1 — Reproduce a stampede, then fix it

Write a script that starts 20 near-simultaneous calls to a cache-aside `get_product` function (no stampede guard) for the same product ID, right after its cache entry has just expired, and count how many times `expensive_recompute` actually runs. Then swap in the `get_product_with_stampede_guard` version above and re-run — confirm the recompute function now runs close to once instead of 20 times.

### Exercise 2 — Add jitter to a batch of TTLs

Write a function that caches 100 different keys, each with a base TTL of 3600 seconds plus a random jitter between 0 and 300 seconds (using Python's `random.randint(0, 300)`, which returns a random integer in that inclusive range). Use `TTL key` in `redis-cli` on a few of them afterward and confirm the values differ instead of all reporting exactly 3600.

### Exercise 3 — Test lock expiration as a safety net

Acquire a stampede-prevention lock with `SET lock:test 1 NX EX 5`, then deliberately don't release it (simulate a crash by simply not calling `DEL`). Poll `TTL lock:test` in `redis-cli` every second and confirm it counts down and the key disappears after 5 seconds on its own, allowing a future request to acquire the lock again.

---

## 7. Interview Q&A

### Q1. What is a cache stampede, and why is it dangerous?

**Answer:** A cache stampede happens when a popular cache key expires (or is missed) and a large number of concurrent requests all experience a miss for that same key at once, each independently querying the database to regenerate the same value. It's dangerous because it turns one expensive query into a simultaneous spike of duplicate load on the exact system the cache was meant to protect, which can overwhelm the database.

---

### Q2. Name two distinct techniques for preventing a cache stampede.

**Answer:** A short-lived distributed lock (e.g. `SET key value NX EX ttl`) ensures only one client repopulates a missed key while others wait briefly or serve a stale value, and jittered TTLs add a small random offset to each key's expiration so a batch of related keys doesn't all expire at the exact same instant.

---

### Q3. Why does the lock in a stampede-prevention scheme need its own expiration (`EX`)?

**Answer:** Without an expiration, a client that crashes after acquiring the lock but before explicitly releasing it (`DEL`) would leave that lock held forever, permanently blocking any future client from repopulating that key. The `EX` acts as a safety net so the lock is released automatically even if the holder never releases it explicitly.

---

### Q4. What's the difference between TTL-based invalidation and explicit invalidation on write?

**Answer:** TTL-based invalidation lets a cached value expire on its own after a fixed duration regardless of whether the underlying data changed, while explicit invalidation actively deletes or updates the cache entry the moment the application writes new data — making fresh data visible immediately instead of waiting out the remaining TTL. Using both together is common: explicit invalidation for immediacy, TTL as a backstop for any write path that forgets to invalidate.

---

### Q5. Why might setting every cache key's TTL to the same round number (e.g. exactly one hour) cause problems at scale?

**Answer:** If a large batch of keys is populated around the same time, giving them all identical TTLs means they all expire at the exact same instant, creating a predictable moment where a stampede is likely — many requests will miss all of those keys simultaneously. Adding a small random jitter to each TTL spreads the expirations out so they don't all land at once.

---

> 🧠 **Memory hook:** "A stale cache is a wrong answer given confidently; a stampede is the right question asked by everyone at once — jittered TTLs and a short-lived lock keep the crowd from rushing the checkout lane the moment it opens."
