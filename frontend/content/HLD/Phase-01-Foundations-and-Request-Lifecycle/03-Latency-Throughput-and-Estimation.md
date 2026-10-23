# Latency, Throughput, and Back-of-Envelope Estimation — Complete Guide

## Table of Contents
1. [Latency vs. Throughput](#1-latency-vs-throughput)
2. [Back-of-Envelope Estimation, Worked](#2-back-of-envelope-estimation-worked)
3. [Latency Numbers Worth Memorizing](#3-latency-numbers-worth-memorizing)
4. [Interview Q&A](#4-interview-qa)

---

## 1. Latency vs. Throughput

These two words get used almost interchangeably in casual conversation, but they answer completely different questions, and mixing them up in an interview is an instant red flag.

- **Latency** — how long *one* request takes, from the moment it's sent to the moment its response is received. Measured in time (milliseconds, seconds).
- **Throughput** — how many requests the system handles *per unit of time*, across all requests happening concurrently. Measured in a rate (requests/sec, transactions/sec).

The reason they aren't the same thing: a system can have "slow" individual requests but still handle a lot of traffic overall, if it processes many of them at the same time.

```
Single request timeline (latency = 200ms):

Request A:  |--- 200ms ---|
                            ▶ response returned


Many requests handled concurrently (throughput = 500 req/s):

Request A:  |--- 200ms ---|
Request B:    |--- 200ms ---|
Request C:      |--- 200ms ---|
Request D:        |--- 200ms ---|
...
(hundreds of overlapping 200ms requests, each individually "slow",
 but the server as a whole is completing ~500 of them every second)
```

Concretely: if a single request takes 200ms of latency, but the backend can have many requests in flight at once (async I/O, multiple worker processes, connection pooling), the system might sustain 500 requests/sec of throughput — even though no single request got any faster. Improving latency (make one request quicker) and improving throughput (handle more requests per second) are often *different engineering problems* with different fixes: latency is attacked with caching, indexing, and reducing network hops; throughput is attacked with more workers, horizontal scaling, and load balancing.

---

## 2. Back-of-Envelope Estimation, Worked

Every design interview eventually asks you to translate a vague scale ("10 million users") into concrete numbers you can actually design against. This is a skill you practice, not a formula you memorize — but the pattern is always the same: start from daily active users (DAU), derive an action rate, then convert that into requests/sec and storage/year.

**Given:** 10 million daily active users (DAU), each posts twice a day, and the average post is 1KB.

**Step 1 — Total posts per day:**
```
10,000,000 users × 2 posts/user/day = 20,000,000 posts/day
```

**Step 2 — Writes per second (average):**
There are 86,400 seconds in a day (24 × 60 × 60).
```
20,000,000 posts/day ÷ 86,400 s/day ≈ 231 writes/sec (average)
```

Real traffic isn't evenly spread across the day — most systems see peak traffic several times higher than the daily average. A common rule of thumb is to assume peak load is roughly 2-3x the average:
```
231 writes/sec (average) × ~3 ≈ 700 writes/sec (peak, rough estimate)
```

**Step 3 — Storage per year:**
```
20,000,000 posts/day × 1 KB/post = 20,000,000 KB/day = ~20 GB/day
20 GB/day × 365 days ≈ 7,300 GB/year ≈ ~7.3 TB/year
```

That's it — no exotic math, just multiplying knowns by knowns and converting units carefully. What interviewers are actually scoring is whether you: state your assumptions out loud (peak multiplier, average post size), keep the units straight (day → second, KB → GB → TB), and use the resulting numbers to justify a design decision later (e.g., "700 writes/sec on a single Postgres instance is fine; 700,000 writes/sec would push us toward sharding" — Phase 05).

---

## 3. Latency Numbers Worth Memorizing

You don't need exact figures, but knowing the *relative order of magnitude* between these lets you reason about where time actually goes in a request — and instantly spot an unrealistic design (like "we'll just hit the database on every request, it's fine").

| Operation | Approximate Latency |
|---|---|
| L1 cache reference | ~1 nanosecond |
| RAM access | ~100 nanoseconds |
| Redis / in-memory cache read (same datacenter) | ~0.5-1 millisecond |
| SSD random read | ~0.1-0.2 milliseconds |
| Network round trip, same datacenter | ~0.5-1 millisecond |
| Database query (indexed, same region) | ~1-10 milliseconds |
| Network round trip, cross-region (e.g. US ↔ Europe) | ~100-150 milliseconds |

The takeaway that matters for interviews: memory and cache access are roughly **1,000x faster** than a network round trip, and a cross-region hop is roughly **100-200x slower** than a same-datacenter one. That gap is the entire justification for caching (Phase 06) and for placing services/data near the users who need them (CDNs, multi-region — Phase 12).

---

## 4. Interview Q&A

**Q: What's the difference between latency and throughput, and can you improve one without improving the other?**
Answer: Latency is how long one request takes; throughput is how many requests the system completes per unit time. Yes — you can increase throughput without touching latency at all (add more servers behind a load balancer so more requests run concurrently, each still taking the same 200ms), and you can reduce latency without changing throughput (add a cache so each request finishes faster, but if you don't also add capacity, you're not necessarily serving more requests per second).

**Q: How would you estimate the write throughput needed for a system with 10 million daily active users, each performing 2 writes a day?**
Answer: Multiply DAU by actions per user to get total daily writes (20 million), divide by seconds in a day (86,400) to get the average rate (~231 writes/sec), then apply a peak multiplier — commonly 2-3x the average — to account for traffic not being evenly spread across the day, landing around 500-700 writes/sec at peak. The specific multiplier matters less than showing you know average traffic and peak traffic are different numbers, and that you should design for peak.

**Q: If each post is about 1KB, how much storage would a system need for a year at 20 million posts/day?**
Answer: 20 million posts/day × 1KB ≈ 20GB/day; over 365 days that's roughly 7.3TB/year for that data alone — before accounting for images/video (which dominate real storage, covered in Phase 08), replication overhead, or backups, all of which multiply this base number further.

**Q: Why do interviewers ask you to do this math instead of just giving you the final numbers?**
Answer: Because the goal isn't the number itself — it's confirming you can translate a business-level scale statement into engineering constraints, and that you'll reach for the right unit conversions and reasonable assumptions (like a peak-to-average traffic ratio) without being spoon-fed them. It also gives the interviewer a natural transition point: once you have "~700 writes/sec," they can ask whether a single database can handle that, which sets up the rest of the interview.

**Q: If a Redis lookup takes about 1ms and a cross-region network round trip takes about 100ms, what does that tell you about where to put your cache?**
Answer: It tells you the cache needs to be close — ideally in the same datacenter or region as the backend calling it — because a "cache" that's a 100ms round trip away barely beats querying a well-indexed database, defeating the point of caching. It's also the core argument for CDNs and multi-region deployments: physical distance to the data dominates almost every other factor once you're talking about network hops instead of local memory or disk access.
