# Phase 06 — Caching

You just spent Phase 05 learning how to make a database survive scale: indexes, replicas, shards. Caching is the phase that lets you avoid asking the database at all. In almost every real system, a tiny fraction of data (a user's profile, a trending post, a product page) is read far more often than it's written — and every one of those reads that hits the database is wasted work you could have skipped. Interviewers bring up caching in nearly every design discussion, and "put a cache in front of it" is only a good answer if you can explain *which* cache pattern, *what* happens when it gets stale, and *why* it won't quietly serve wrong data to a million users.

This phase builds the mental model for caching from the pattern you'll use constantly (cache-aside) through to how caches actually decide what to throw away, and finally the concrete tool (Redis) you'll reach for in nearly every case study later in this course.

## What This Phase Covers

- The cache-aside pattern: check the cache first, fall back to the database on a miss, and populate the cache for next time — the default caching strategy in almost every backend.
- Write-through caching as a contrast, and why cache-aside is more common despite being "lazier."
- Eviction policies (LRU, LFU, TTL) — how a cache with finite memory decides what to keep when it's full.
- Invalidation strategies — the harder half of caching, and the classic "stale cache after a database update" bug that catches almost everyone at least once.
- Redis beyond simple key-value caching: rate limiting, session storage, leaderboards, and pub/sub — the same tool showing up again and again in later case studies.

## Lesson Files

| # | File | Topic |
|---|------|-------|
| 01 | `01-Cache-Aside-Pattern.md` | Cache-aside flow, the check-miss-populate code pattern, contrast with write-through |
| 02 | `02-Eviction-and-Invalidation.md` | LRU/LFU/TTL eviction, invalidation strategies, the stale-cache bug |
| 03 | `03-Redis-in-Practice.md` | Rate limiting, session storage, leaderboards (sorted sets), pub/sub |

## Estimated Time

**2 days** (one lesson per sitting is enough — the ideas are simple, but the failure modes in Lesson 02 are worth sitting with).

## Prerequisites

- Phase 05 (Database Design and Scaling) — caching only makes sense once you understand what it's protecting: a database that's slow or expensive to query repeatedly.
