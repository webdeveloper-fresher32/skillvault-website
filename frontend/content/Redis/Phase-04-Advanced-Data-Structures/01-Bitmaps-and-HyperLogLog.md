# 01 — Bitmaps and HyperLogLog

> A comprehensive reference covering compact boolean-flag tracking with Bitmaps and memory-efficient approximate distinct counting with HyperLogLog.

---

## Table of Contents

1. [The Problem: Counting at Massive Scale Gets Expensive](#1-the-problem-counting-at-massive-scale-gets-expensive)
2. [The Analogy: A Punch Card and a Bouncer's Head-Count](#2-the-analogy-a-punch-card-and-a-bouncers-head-count)
3. [Internal Flow: Bitmaps](#3-internal-flow-bitmaps)
4. [Internal Flow: HyperLogLog](#4-internal-flow-hyperloglog)
5. [Code Example: Daily Active Users and Unique Visitors](#5-code-example-daily-active-users-and-unique-visitors)
6. [Bitmap vs HyperLogLog vs Set](#6-bitmap-vs-hyperloglog-vs-set)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. The Problem: Counting at Massive Scale Gets Expensive

Two very common questions show up constantly in real systems, and both get expensive fast with "normal" data structures:

- **"Was user X active on day Y?"** — asked across millions of users, every day, for months. If you tried to model this with, say, a Hash where every user gets a field per day, you'd be storing millions of keys/fields for what is fundamentally a single yes/no answer per user per day.
- **"How many unique visitors did we have?"** — asked across events that can run into the billions. Tracking this exactly means storing every distinct visitor ID somewhere (a Set, for example) so you can count how many unique members exist. At billions of events, even a Set of unique IDs can grow to gigabytes of memory just to answer one number.

Both questions are really about *compact representation*: one is a huge number of simple boolean flags, the other is a huge count of distinct things. Redis has a data structure purpose-built for each: **Bitmaps** for the boolean-flag case, and **HyperLogLog** for the distinct-count case.

---

## 2. The Analogy: A Punch Card and a Bouncer's Head-Count

**Real-world analogy for Bitmaps:** think of an old-fashioned employee punch card with one hole position per day of the month. Punching a hole at position 15 means "present on day 15" — a single bit, not a whole record. A Bitmap is exactly this: a string of bits where each *position* (called an "offset") represents one flag, and you flip it on or off. A million users' daily attendance for one day fits in about 125KB of bits, because each user costs exactly one bit, not one row.

**Real-world analogy for HyperLogLog:** imagine a bouncer at a massive festival trying to answer "how many *different* people have come through this gate today?" without writing down every single name. Instead, the bouncer uses a clever trick — watching patterns in people's ticket numbers (or any other proxy) that let them produce a very good *estimate* of the unique count using a small notebook, instead of a full guest list. HyperLogLog does exactly this mathematically: it uses probabilistic counting to estimate cardinality using a small, fixed amount of memory, trading perfect accuracy for a massive memory saving.

---

## 3. Internal Flow: Bitmaps

A Redis Bitmap isn't actually a distinct data type — it's a String, but accessed via bit-level commands instead of whole-value commands:

- **`SETBIT key offset value`** — sets the bit at `offset` to `0` or `1`. Returns the bit's *previous* value at that offset (before the set).
- **`GETBIT key offset`** — reads the bit at `offset`. Returns `0` if the offset was never set.
- **`BITCOUNT key [start end]`** — counts how many bits are set to `1`, optionally restricted to a byte range.
- **`BITOP AND|OR|XOR|NOT destkey key [key ...]`** — combines multiple Bitmaps bitwise, useful for questions like "active on both day 1 AND day 2."

The key design point: offsets are just integer positions, so a natural pattern is to use a user's numeric ID as the offset into a per-day Bitmap key. One Bitmap key per day, one bit per user, and `BITCOUNT` answers "how many users were active this day" instantly.

---

## 4. Internal Flow: HyperLogLog

HyperLogLog (often abbreviated **HLL**) is a probabilistic data structure for estimating the number of *distinct* elements added to it:

- **`PFADD key element [element ...]`** — adds one or more elements. Redis internally hashes each element and updates a small set of registers used for the estimate; it does not store the actual elements. Returns `1` if the internal HLL representation was altered (i.e., the estimate might have changed) or `0` if nothing changed.
- **`PFCOUNT key [key ...]`** — returns the *approximate* cardinality (distinct count) of one HLL, or the estimated union cardinality across multiple HLL keys.
- **`PFMERGE destkey sourcekey [sourcekey ...]`** — merges multiple HLLs into one, useful for combining, say, "unique visitors per day" into "unique visitors per week."

The headline number to remember: Redis's HyperLogLog implementation uses only **~12KB of memory per key**, regardless of whether you've added a thousand elements or a billion, with a standard error of about **0.81%**. That's the entire trade: you give up exactness for a fixed, tiny memory footprint that doesn't grow with cardinality.

---

## 5. Code Example: Daily Active Users and Unique Visitors

**Tracking daily active users with a Bitmap** — mark user `1001` as active on `2026-07-25`:

```
127.0.0.1:6379> SETBIT dau:2026-07-25 1001 1
(integer) 0
127.0.0.1:6379> BITCOUNT dau:2026-07-25
(integer) 1
```

The `SETBIT` reply of `0` is the *previous* value of that bit (it was unset before), not a confirmation flag — this trips people up the first time. `BITCOUNT` then reports exactly one bit set. If a second user, `1002`, also logs in that day, `SETBIT dau:2026-07-25 1002 1` followed by `BITCOUNT dau:2026-07-25` would return `(integer) 2`.

**Approximate unique-visitor counting with HyperLogLog** — note `"user1"` is added twice, on purpose, to demonstrate deduplication:

```
127.0.0.1:6379> PFADD visitors:2026-07-25 "user1" "user2" "user1"
(integer) 1
127.0.0.1:6379> PFCOUNT visitors:2026-07-25
(integer) 2
```

Even though three values were passed to `PFADD`, `"user1"` only counts once — `PFCOUNT` correctly reports `2` distinct visitors. At this tiny scale HyperLogLog's estimate is effectively exact; the ~0.81% standard error becomes meaningful once you're counting millions of distinct elements, where being off by roughly 1% is still a dramatically better trade than storing every element in a Set.

**Python (`redis-py`) equivalent:**

```python
import redis

r = redis.Redis(host="localhost", port=6379, decode_responses=True)

# Bitmap: mark user 1001 active today
r.setbit("dau:2026-07-25", 1001, 1)
print(r.bitcount("dau:2026-07-25"))  # 1

# HyperLogLog: approximate unique visitor count
r.pfadd("visitors:2026-07-25", "user1", "user2", "user1")
print(r.pfcount("visitors:2026-07-25"))  # 2
```

`r.pfadd(key, *elements)` uses Python's variadic-argument syntax (the `*args` pattern) under the hood in `redis-py`'s method signature, letting you pass any number of elements as separate arguments rather than building a list yourself.

---

## 6. Bitmap vs HyperLogLog vs Set

| | **Bitmap** | **HyperLogLog** | **Set** |
|---|---|---|---|
| **What it answers** | "Is flag N on/off?" / count of flags on | "Approximately how many distinct elements?" | "What are the exact distinct elements?" |
| **Memory profile** | 1 bit per possible offset (dense, sequential ranges are cheapest) | Fixed ~12KB regardless of cardinality | Grows with number and size of elements |
| **Exactness** | Exact | Approximate (~0.81% standard error) | Exact |
| **Can retrieve members?** | No — only positions/counts, not "who" | No — only the count, never the actual elements | Yes — `SMEMBERS` returns every element |
| **Best for** | Dense per-ID boolean flags (attendance, feature flags) | Huge-scale distinct counting (unique visitors, unique IPs) | Moderate-scale sets where you need the actual members |

---

**Common mistakes:**
- Reaching for HyperLogLog when you actually need the *exact* count or need to know *which* elements were seen — HLL by design discards the ability to list members and only ever gives you an estimate.
- Using a Bitmap for a sparse, huge key-space — e.g., flagging users by a 64-bit random ID instead of a small sequential integer. A Bitmap allocates space up to the highest offset touched, so a single huge offset can silently allocate an enormous string; a Set of the (far fewer) actual "on" IDs would use less memory in that case.

**Interview angle:** Expect a question like "how would you count unique visitors across a billion page views without exploding memory usage?" The expected answer is HyperLogLog, explained with its actual trade-off (fixed ~12KB memory, ~0.81% error, no ability to retrieve individual members) — not just "use a Set," which technically works but doesn't scale, and not a vague "Redis has something for that" without naming `PFADD`/`PFCOUNT` or the accuracy trade-off.

---

## 7. Hands-On Exercises

### Exercise 1 — Track a week of activity with Bitmaps

Using `redis-cli`, create one Bitmap key per day for a week (e.g. `dau:2026-07-19` through `dau:2026-07-25`), set a handful of user-ID bits in each, and use `BITCOUNT` to report each day's active-user count. Then use `BITOP AND destkey dau:2026-07-19 dau:2026-07-20` and `BITCOUNT destkey` to find how many users were active on *both* of those two days.

### Exercise 2 — Compare a Set and a HyperLogLog on the same data

Add the same 50 unique string values to both a Set (`SADD`) and a HyperLogLog (`PFADD`) under different keys. Compare `SCARD` (exact count) against `PFCOUNT` (estimate) — at this size they should match or be extremely close. Then use `DEBUG OBJECT` or `MEMORY USAGE` on both keys to compare their actual memory footprint.

### Exercise 3 — Merge two days of visitors into a weekly total

Create two HyperLogLog keys, `visitors:day1` and `visitors:day2`, with some overlapping and some unique values. Use `PFMERGE visitors:week destkey sourcekey...` to combine them, then `PFCOUNT visitors:week` to see the merged unique count — verify it's less than or equal to the sum of the two individual `PFCOUNT` results (because of the overlap).

---

## 8. Interview Q&A

### Q1. What is a Redis Bitmap, really?

**Answer:** A Bitmap isn't a separate data type — it's a regular Redis String accessed through bit-level commands like `SETBIT`, `GETBIT`, and `BITCOUNT`. It's ideal for representing a large number of boolean flags compactly, such as one bit per user ID marking daily activity.

### Q2. What does `PFADD` actually store, and what does `PFCOUNT` return?

**Answer:** `PFADD` doesn't store the actual elements you pass it — it hashes each element and updates a small set of internal registers used to estimate cardinality. `PFCOUNT` returns an *approximate* count of distinct elements ever added, with a standard error of about 0.81%, using a fixed ~12KB of memory regardless of how many elements were added.

### Q3. Why would you choose HyperLogLog over a Set for counting unique visitors?

**Answer:** A Set must store every distinct element, so memory grows linearly with cardinality — at billions of unique visitors that can mean gigabytes. HyperLogLog uses a fixed ~12KB per key no matter the cardinality, trading a small (~0.81%) error for a dramatic and constant memory saving.

### Q4. When would a Set actually be a better choice than a Bitmap for boolean flags?

**Answer:** When the key-space is sparse and the possible offsets are enormous (e.g., random 64-bit IDs), a Bitmap would allocate space up to the highest offset touched, potentially wasting huge amounts of memory for very few actual flags. A Set storing only the IDs that are actually "on" avoids that waste, at the cost of losing the O(1) direct-offset lookup a Bitmap provides.

### Q5. Can you retrieve the original elements back out of a HyperLogLog?

**Answer:** No — HyperLogLog is a one-way, lossy structure. It can tell you an estimated count of distinct elements added, but it never stores or can reproduce the actual elements; if you need to list members, you need a Set instead.

---

> 🧠 **Memory hook:** "A Bitmap is a punch card — one bit, one flag, one position. HyperLogLog is a bouncer's head-count — no guest list, just a shockingly good estimate in a tiny notebook."
