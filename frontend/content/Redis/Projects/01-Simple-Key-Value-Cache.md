# Project 01 — Simple Key-Value Cache

## Goal

Wrap a deliberately slow Python function in a cache-aside layer so that the first call pays the full cost, but every subsequent call for the same input returns almost instantly from Redis.

## What You'll Build

A small Python module with one "slow" function (e.g. `compute_expensive_result(n)` that calls `time.sleep(1)` before returning a computed value) and a caching wrapper around it that checks Redis first, falls back to the slow function on a miss, and stores the result with an expiration so it doesn't stay stale forever.

## Phases Required

- Phase 1 — Redis Fundamentals
- Phase 2 — Core Data Structures
- Phase 3 — Keys, Expiration and Eviction

## Requirements

- A function `slow_compute(n)` that simulates expensive work with `time.sleep(1)` (or similar) and returns a deterministic, computed value for a given `n`.
- A `get_cached_result(n)` function that:
  - Checks Redis for a key derived from `n` (e.g. `result:{n}`).
  - On a hit, returns the cached value without calling `slow_compute`.
  - On a miss, calls `slow_compute(n)`, stores the result in Redis with a TTL, and returns it.
- The cached key must expire on its own (no manual cleanup) using `SET ... EX` or `SETEX`.
- Calling `get_cached_result` twice in a row for the same `n` must be measurably faster the second time — time both calls and print the difference.
- Calling it again after the TTL has elapsed must re-trigger the slow path.

## Suggested Approach

1. Write `slow_compute(n)` first, standalone, and confirm it behaves deterministically (same `n` always produces the same output) before wiring any caching around it — the cache is worthless if the underlying function isn't repeatable.
2. Pick a key naming scheme for the cached values (e.g. `result:<n>`) and decide on a TTL that's short enough to demo quickly (a few seconds) while building, then a more realistic value (minutes) once it works.
3. Implement the check-then-set flow: `GET` the key, and only fall through to `slow_compute` plus a `SET ... EX` on a miss (a `None` return from `GET`).
4. Add simple timing around both a first call (miss) and a second call (hit) using Python's `time` module, and print the elapsed time for each so the speedup is visible.
5. Test the expiration path deliberately: set a very short TTL, sleep past it, and confirm the next call is slow again — this proves the cache is actually expiring, not just always missing or always hitting.

## Stretch Goals

- Add a manual invalidation function that deletes a cached key on demand, and show that the very next call is slow again even before the TTL expires.
- Extend the cache to store more complex values (a dict) using JSON serialization instead of a single computed number.
- Add a simple hit/miss counter (two Redis String counters incremented with `INCR`) and print a running hit ratio after several calls.

## Evaluation Checklist

- [ ] First call for a given `n` is slow (pays the full `slow_compute` cost).
- [ ] Second call for the same `n`, before the TTL expires, is measurably fast and returns the identical value.
- [ ] The cached key has a visible TTL in Redis (confirmed with `TTL` in `redis-cli` or `r.ttl(...)` in Python).
- [ ] After the TTL expires, the next call for that `n` is slow again, proving the cache actually expired rather than persisting forever.
- [ ] No code path calls `GET` and then blindly assumes a non-`None` result without handling the miss case.
