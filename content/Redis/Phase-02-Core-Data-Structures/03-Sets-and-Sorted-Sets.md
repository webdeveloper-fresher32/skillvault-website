# 03 — Sets and Sorted Sets

> A comprehensive reference covering Redis Sets (unique, unordered membership) and Sorted Sets (unique membership with a score-based order), including tagging, set algebra, and leaderboards.

---

## Table of Contents

1. [The Problem: Uniqueness, and Uniqueness With Order](#1-the-problem-uniqueness-and-uniqueness-with-order)
2. [The Analogy: A Guest List, and a Guest List Sorted by Points](#2-the-analogy-a-guest-list-and-a-guest-list-sorted-by-points)
3. [Sets: SADD, SMEMBERS, SISMEMBER, and Set Algebra](#3-sets-sadd-smembers-sismember-and-set-algebra)
4. [Sorted Sets: ZADD, ZRANGE, ZSCORE, ZINCRBY, ZCARD, ZREMRANGEBYSCORE](#4-sorted-sets-zadd-zrange-zscore-zincrby-zcard-zremrangebyscore)
5. [Building a Tag System and a Leaderboard](#5-building-a-tag-system-and-a-leaderboard)
6. [Comparison: Set vs Sorted Set vs List](#6-comparison-set-vs-sorted-set-vs-list)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. The Problem: Uniqueness, and Uniqueness With Order

Two more shapes of problem come up constantly that neither a String, a List, nor a Hash models well:

- **"No duplicates."** A list of tags on a blog post, the set of user IDs who liked something, the distinct set of permissions a role has — in every one of these, adding the same item twice should be a no-op, not a duplicate entry. A List would happily let you push the same value in twice; that's the wrong tool here.
- **"No duplicates, but also ranked."** A leaderboard needs uniqueness (each player appears once) *and* an ordering by score, with the ability to efficiently ask "who's in the top 10?" or "what's Bob's rank?"

Redis has a structure for each: **Sets** for pure uniqueness, and **Sorted Sets** for uniqueness plus an ordering.

---

## 2. The Analogy: A Guest List, and a Guest List Sorted by Points

**Real-world analogy for Sets:** a guest list at the door of an event. Each name gets checked off once; if the same person's name gets called out twice, it doesn't create a second entry — they're either on the list or they're not. That's exactly what a Redis Set guarantees: adding an element that's already present changes nothing.

**Real-world analogy for Sorted Sets:** the same guest list, except now every guest also has a running point total from a game they've been playing, and the list is kept sorted by that score at all times — "who's currently in first place?" is a fast, direct question, not something you compute by scanning the whole list. That's a Sorted Set: a Set's uniqueness guarantee, plus a numeric score attached to every member that Redis keeps sorted by automatically.

---

## 3. Sets: SADD, SMEMBERS, SISMEMBER, and Set Algebra

Core Set commands:

- `SADD key member [member ...]` — add one or more members; returns the number of members that were **newly** added (duplicates already present don't count).
- `SMEMBERS key` — return all members (no guaranteed order).
- `SISMEMBER key member` — returns `1` if the member is present, `0` if not.
- `SINTER key [key ...]` — set intersection (members present in *all* given sets).
- `SUNION key [key ...]` — set union (members present in *any* given set).
- `SDIFF key [key ...]` — set difference (members in the first set that are *not* in the others).

```bash
redis-cli> SADD post:123:tags "redis" "database" "caching"
(integer) 3
redis-cli> SADD post:123:tags "redis"
(integer) 0
redis-cli> SISMEMBER post:123:tags "redis"
(integer) 1
redis-cli> SISMEMBER post:123:tags "mongodb"
(integer) 0
```

Notice the second `SADD` returns `0` — `"redis"` was already a member, so nothing new was added; the set still has exactly 3 members.

```python
r.sadd("post:123:tags", "redis", "database", "caching")   # 3
r.sadd("post:123:tags", "redis")                          # 0 — already present
print(r.sismember("post:123:tags", "redis"))               # True (redis-py returns a bool)
print(r.sismember("post:123:tags", "mongodb"))              # False
```

---

## 4. Sorted Sets: ZADD, ZRANGE, ZSCORE, ZINCRBY, ZCARD, ZREMRANGEBYSCORE

Core Sorted Set commands:

- `ZADD key score member [score member ...]` — add member(s) with a given score; returns the number of members **newly** added (updating an existing member's score doesn't count toward this number).
- `ZRANGE key start stop [WITHSCORES]` — return members in **ascending** score order by index range.
- `ZREVRANGE key start stop [WITHSCORES]` — return members in **descending** score order.
- `ZSCORE key member` — return a single member's score.
- `ZINCRBY key increment member` — add `increment` to a member's existing score, returning the new score.
- `ZCARD key` — return the total number of members in the Sorted Set, in O(1) time (no need to fetch every member just to count them).
- `ZREMRANGEBYSCORE key min max` — remove every member whose score falls within `[min, max]`, returning the number of members removed. This is the command that makes Sorted Sets useful as a **sliding-window counter**, not just a leaderboard: if you `ZADD` a member per event with the current Unix timestamp as its score, `ZREMRANGEBYSCORE key -inf <window-start>` cheaply drops everything older than your window, and `ZCARD` then tells you how many events remain inside it — the two commands together are the core building block behind a Redis sliding-window rate limiter (see `Projects/03-Rate-Limiter-Using-Sorted-Sets.md`).

```bash
redis-cli> ZADD leaderboard 100 "alice"
(integer) 1
redis-cli> ZADD leaderboard 250 "bob"
(integer) 1
redis-cli> ZREVRANGE leaderboard 0 -1 WITHSCORES
1) "bob"
2) "250"
3) "alice"
4) "100"
```

`ZREVRANGE leaderboard 0 -1 WITHSCORES` returns every member from highest to lowest score — bob (250) ranks first, ahead of alice (100), with each member immediately followed by its score in the reply.

```python
r.zadd("leaderboard", {"alice": 100})   # 1
r.zadd("leaderboard", {"bob": 250})     # 1
print(r.zrevrange("leaderboard", 0, -1, withscores=True))
# [('bob', 250.0), ('alice', 100.0)]
```

`redis-py` parses `WITHSCORES` into a list of `(member, score)` tuples, with scores returned as Python `float` — Sorted Set scores are always floating-point internally, even when you add them as whole numbers like `100`.

`ZINCRBY` is the Sorted Set equivalent of `INCR` — atomically bump a member's score:

```bash
redis-cli> ZINCRBY leaderboard 25 "alice"
"125"
```

---

## 5. Building a Tag System and a Leaderboard

The tag system from Section 3 lets you cheaply check membership without scanning a list:

```bash
redis-cli> SMEMBERS post:123:tags
1) "redis"
2) "database"
3) "caching"
```

(Order in the reply isn't guaranteed to match insertion order — Sets don't track that.)

The leaderboard from Section 4 supports both "who's on top" and "what's this specific score":

```bash
redis-cli> ZSCORE leaderboard "bob"
"250"
redis-cli> ZRANGE leaderboard 0 -1 WITHSCORES
1) "alice"
2) "125"
3) "bob"
4) "250"
```

`ZRANGE` (ascending) puts alice first here since her score (125, after the `ZINCRBY` above) is now lower than bob's (250).

---

## 6. Comparison: Set vs Sorted Set vs List

| | **Set** | **Sorted Set** | **List** |
|---|---|---|---|
| **Uniqueness enforced?** | Yes | Yes | No — duplicates allowed |
| **Ordering** | None — unordered | Sorted by score, always | Insertion order |
| **Typical use case** | Tags, unique visitor IDs, permission sets | Leaderboards, priority queues, anything ranked by a number | Queues, recent-activity feeds, logs |
| **Key commands** | `SADD`, `SMEMBERS`, `SISMEMBER`, `SINTER`/`SUNION`/`SDIFF` | `ZADD`, `ZRANGE`/`ZREVRANGE`, `ZSCORE`, `ZINCRBY`, `ZCARD`, `ZREMRANGEBYSCORE` | `LPUSH`/`RPUSH`, `LRANGE`, `LPOP`/`RPOP` |

**Common mistakes:**
- Using a List where uniqueness is actually required — a List allows silent duplicates, so a "list of user IDs who liked this post" built with `LPUSH` can end up with the same user counted multiple times unless you separately check for duplicates yourself; a Set makes that impossible by construction.
- Forgetting that Sorted Set scores are **floats**, not just integers — this is genuinely useful, since a common trick is encoding a timestamp into the score's fractional part (or combining a primary sort value with a tiny tie-breaking fraction) to break ties deterministically without a second data structure.

**Interview angle:** "How would you build a leaderboard in Redis?" is one of the most common Redis interview questions, and the expected answer is a Sorted Set keyed by, e.g., `leaderboard`, with `ZADD`/`ZINCRBY` to update scores and `ZREVRANGE ... WITHSCORES` to fetch the top N. A strong candidate also mentions that `ZADD`'s "number of new elements" return value is easy to misread as "number of elements changed" — it only counts genuinely new members, not score updates to existing ones — which is exactly the kind of return-value detail interviewers probe to check real hands-on familiarity versus surface-level knowledge.

---

## 7. Hands-On Exercises

### Exercise 1 — Deduplicate with a Set

Using `redis-cli`, run `SADD visitors:demo "u1" "u2" "u1" "u3"` in one call. Predict the return value before running it (how many were *newly* added), then confirm with `SMEMBERS visitors:demo` that `"u1"` only appears once.

### Exercise 2 — Rank three players

Using `redis-py`, `zadd` three players onto a key called `game:demo` with distinct scores. Use `zrevrange` with `withscores=True` to print them from first to last place, then use `zincrby` to bump the last-place player above second place, and re-run `zrevrange` to confirm the new order.

### Exercise 3 — Set algebra for shared tags

Create two Sets, `post:1:tags` and `post:2:tags`, each with a mix of overlapping and unique tag names using `SADD`. Run `SINTER post:1:tags post:2:tags` to find tags both posts share, and `SDIFF post:1:tags post:2:tags` to find tags only the first post has.

---

## 8. Interview Q&A

### Q1. What guarantee does a Redis Set provide that a List doesn't?

**Answer:** Uniqueness — adding a member that's already present via `SADD` is a no-op and doesn't create a duplicate entry, whereas a List (via `LPUSH`/`RPUSH`) has no such guarantee and will happily store the same value multiple times.

---

### Q2. How would you implement a real-time leaderboard in Redis?

**Answer:** With a Sorted Set: `ZADD leaderboard <score> <member>` to add or update a player's score, `ZINCRBY leaderboard <delta> <member>` to atomically adjust it, and `ZREVRANGE leaderboard 0 N WITHSCORES` to fetch the top N players in descending score order.

---

### Q3. What does `ZADD` return, and what's a common misunderstanding about it?

**Answer:** `ZADD` returns the number of members that were **newly added** to the Sorted Set — not the number of members whose score was changed. Updating an existing member's score with `ZADD` doesn't increment this return value, which surprises people expecting it to reflect "how many writes just happened."

---

### Q4. Are Sorted Set scores always integers?

**Answer:** No — Sorted Set scores are stored as floating-point numbers internally, even if you add them as whole numbers. This is useful for encoding fine-grained tie-breaking information (like a timestamp) into the score alongside a primary ranking value.

---

### Q5. How do you check whether a specific item exists in a Set without fetching the whole thing?

**Answer:** `SISMEMBER key member`, which returns `1` (or `True` in `redis-py`) if the member exists and `0`/`False` otherwise — an O(1) membership check that avoids pulling the entire Set across the network just to test for one value, unlike scanning a full `SMEMBERS` result in application code.

---

> 🧠 **Memory hook:** "A Set is a guest list — no name twice. A Sorted Set is that same guest list, but always kept sorted by each guest's score — no duplicates, and instant answers to 'who's winning?'"
