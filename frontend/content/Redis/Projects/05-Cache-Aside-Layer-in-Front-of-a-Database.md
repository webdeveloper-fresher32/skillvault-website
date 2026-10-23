# Project 05 — Cache-Aside Layer in Front of a Database

## Goal

Build a full cache-aside layer in front of a real (or simulated) database, including invalidation on writes and stampede-prevention locking for a hot key, going beyond Project 01's basic version.

## What You'll Build

A small Python data-access layer with `get_record(id)` and `update_record(id, new_value)` functions backed by a simulated database (a Python dict standing in for a real DB, or an actual SQLite/file-backed store if you want more realism), fronted by Redis using the cache-aside pattern with proper write-time invalidation and a lock-based guard against cache stampedes on a hot key.

## Phases Required

- Phase 10 — Caching Patterns and Strategies
- Phase 11 — Redis with Application Code

## Requirements

- `get_record(id)` must check Redis first; on a miss, read from the simulated database, populate Redis with a TTL, and return the value.
- `update_record(id, new_value)` must write to the simulated database and then invalidate (delete) the corresponding cache key, so the next read repopulates fresh rather than serving the old cached value.
- Values stored in Redis must be serialized (e.g. with `json.dumps`/`json.loads`) since the underlying records are Python dicts, not plain strings.
- Implement stampede prevention for at least one "hot key": when many concurrent callers miss the cache for the same key at once, only one of them should actually hit the simulated database and repopulate the cache; the others should wait briefly or serve a fallback rather than all hitting the database simultaneously.
- Handle the case where `r.get(key)` returns `None` before attempting to `json.loads` it — a miss must not crash the deserialization step.
- Demonstrate correct behavior for at least three cases: a cold cache read, a repeat read hitting the cache, and a write followed immediately by a read showing the updated value (not a stale cached one).

## Suggested Approach

1. Build the simulated database layer first, independent of caching — a dict-backed `db_get(id)`/`db_update(id, value)` pair with a small artificial delay (`time.sleep`) so cache hits are visibly faster than misses.
2. Layer in basic cache-aside on top, following the same shape as Phase 10's cache-aside example: check Redis, fall through to the simulated DB on a miss, `SET ... EX` with a TTL, always wrapping stored values in `json.dumps` and parsed results in `json.loads`.
3. Add write-time invalidation to `update_record`: write to the simulated DB first, then `DEL` the cache key — verify a `get_record` call right after an update is slow again (proving the stale value wasn't served) and returns the new value.
4. Pick one key to treat as "hot" and simulate a stampede: fire several concurrent (or rapid sequential, if not using real threads) `get_record` calls for the same freshly-invalidated hot key and observe, without any lock, that the simulated database gets hit multiple times at once.
5. Add stampede prevention using a short-lived lock acquired with `SET lock:<key> 1 NX EX <ttl>` — only the caller that successfully acquires the lock repopulates the cache from the database; other concurrent callers either wait briefly and retry the cache read, or serve a stale/fallback value if one is available, instead of all reading from the database simultaneously.
6. Re-run the stampede scenario with locking in place and confirm the simulated database is now hit only once, not once per concurrent caller.

## Stretch Goals

- Add jittered TTLs (a small random offset added to the base TTL) across multiple keys and explain, in a short write-up, how this reduces the odds of many keys expiring in the same instant.
- Add a probabilistic early-refresh mechanism: recompute a cache entry slightly before its actual expiration, weighted by how expensive recomputing it is, instead of waiting for a hard miss.
- Swap the simulated dict-backed database for a real lightweight one (SQLite) to see the pattern hold with an actual disk-backed store instead of an in-memory stand-in.

## Evaluation Checklist

- [ ] A cold read for a given `id` is slow (hits the simulated database) and populates the cache.
- [ ] A repeat read for the same `id` is fast and returns identical data from the cache.
- [ ] An update followed immediately by a read returns the new value, not a stale cached one — invalidation on write works correctly.
- [ ] Without stampede protection, multiple concurrent misses on a hot key are shown to hit the simulated database multiple times at once.
- [ ] With the lock-based stampede protection in place, the same concurrent-miss scenario results in only one caller actually hitting the simulated database.
- [ ] No code path passes a cache miss (`None`) directly into `json.loads` without checking for it first.
