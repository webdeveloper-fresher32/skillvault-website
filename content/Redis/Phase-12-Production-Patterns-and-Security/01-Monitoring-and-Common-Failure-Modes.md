# 01 — Monitoring and Common Failure Modes

> A comprehensive reference covering the key Redis metrics worth watching, how to read `INFO` and `SLOWLOG` output, and the production failure modes that a healthy-looking Redis instance can be quietly heading toward.

---

## Table of Contents

1. [The Problem: "Seems Fine" Is Not the Same as "Fine"](#1-the-problem-seems-fine-is-not-the-same-as-fine)
2. [The Analogy: The Dashboard Warning Light](#2-the-analogy-the-dashboard-warning-light)
3. [Key Metrics to Watch](#3-key-metrics-to-watch)
4. [Reading INFO and SLOWLOG](#4-reading-info-and-slowlog)
5. [Common Production Failure Modes](#5-common-production-failure-modes)
6. [Hands-On Exercises](#6-hands-on-exercises)
7. [Interview Q&A](#7-interview-qa)

---

## 1. The Problem: "Seems Fine" Is Not the Same as "Fine"

A Redis instance can look completely healthy from the outside — the process is up, `PING` returns `PONG`, response times look normal — while quietly sitting on top of a problem that's about to become an outage. A single enormous key that's growing unbounded. A cache whose hit ratio has silently collapsed to near zero because keys expire faster than they can ever be reused. A handful of slow commands that are eating into the single-threaded event loop's budget (Phase 1) without anyone noticing, because nobody's looking at anything other than "is the process running."

By the time any of these becomes visible as an actual incident — memory exhausted, latency spiking, writes failing — the problem has usually existed, invisibly, for hours, days, or weeks. The core question this lesson answers: **what should you actually be watching, on an ongoing basis, so you notice a Redis instance drifting toward trouble long before it becomes one?**

---

## 2. The Analogy: The Dashboard Warning Light

**Real-world analogy:** a car's dashboard has an oil-pressure light, a temperature gauge, and a fuel gauge — not because the engine is currently broken, but so you notice low oil pressure *before* the engine seizes, and a rising temperature *before* it overheats on the highway. Nobody waits for smoke to start pouring out of the hood to check the oil.

Redis exposes an equivalent set of gauges through the `INFO` command and the slow log — memory usage relative to your configured ceiling, how often reads are actually being served from cache versus falling through, how many clients are connected, and which specific commands are taking unusually long. Watching these regularly is the difference between catching a rising "temperature" while it's still a minor tuning issue, and finding out about it only once the engine — the whole Redis instance — has already seized under load.

---

## 3. Key Metrics to Watch

A handful of numbers, watched consistently, catch the overwhelming majority of Redis production problems before they become outages:

- **Memory usage vs. `maxmemory`** — how close is the instance to its configured ceiling (Phase 3)? An instance creeping toward `maxmemory` with `noeviction` set is heading toward write failures; one with an eviction policy set is heading toward evicting keys you may not expect to lose.
- **`keyspace_hits` / `keyspace_misses`** — how many reads were served directly from Redis (`hits`) versus how many asked for a key that wasn't there (`misses`). The ratio between these is your cache's **hit ratio**, arguably the single most important health signal for a Redis-as-cache deployment.
- **`connected_clients`** — a slowly climbing client count with no matching increase in real traffic often means client connections aren't being closed or pooled correctly somewhere upstream (Phase 11).
- **The slow log** — a rolling log of commands that took longer than a configurable threshold to execute, letting you catch the "one giant `KEYS *` scan" or "one huge value" class of problem directly, by command, instead of only seeing its downstream symptom (overall latency).

---

## 4. Reading INFO and SLOWLOG

The `INFO` command is the primary window into a running Redis instance's internal state. It's organized into sections, and you can request one section at a time instead of the (very long) full output.

```bash
redis-cli INFO memory
```

Real fields you'll see in that output include:

```
used_memory_human:12.55M
used_memory_peak_human:14.02M
maxmemory_human:0B
maxmemory_policy:noeviction
mem_fragmentation_ratio:1.03
```

`used_memory_human` is the actual memory Redis is currently using, in a human-readable unit. `maxmemory_human` of `0B` means no ceiling is configured at all — worth flagging, since it means Redis will keep growing until the *operating system* runs out of memory rather than Redis gracefully enforcing a policy. `mem_fragmentation_ratio` above roughly 1.5 is generally a sign of memory fragmentation worth investigating; a value close to 1.0 is healthy.

```bash
redis-cli INFO stats
```

Relevant fields here:

```
keyspace_hits:184320
keyspace_misses:9142
expired_keys:501
evicted_keys:0
```

From these two counters, you can compute the cache hit ratio directly:

```
hit_ratio = keyspace_hits / (keyspace_hits + keyspace_misses)
          = 184320 / (184320 + 9142)
          ≈ 0.9527   →  ~95.3%
```

A hit ratio that's trending downward over time — even if it's still numerically "high" — is worth investigating: it usually means either TTLs are too short for the actual access pattern, or the working set genuinely no longer fits comfortably in memory.

Slow commands get their own dedicated log, separate from `INFO`:

```bash
redis-cli SLOWLOG GET 10
```

This returns the 10 most recent entries that exceeded the configured slow-log threshold (`slowlog-log-slower-than`, in microseconds), each entry containing a unique ID, a Unix timestamp, the execution time in microseconds, and the command and its arguments. Sorting through repeated entries for the same command is usually the fastest way to find the specific query pattern quietly costing you the most.

---

## 5. Common Production Failure Modes

| Failure Mode | What Happens | Where It's Covered |
|---|---|---|
| **One enormous key/value** | A single very large value (a huge List, Hash, or String) takes a noticeably long time to read, write, or delete — and since command execution is single-threaded (Phase 1), that one slow operation blocks *every other client* until it finishes. | Phase 1 (event loop) |
| **Unbounded key growth** | Without a `maxmemory` ceiling and eviction policy, Redis keeps accepting new keys until the OS itself runs out of memory — this is a much worse failure than a controlled eviction. | Phase 3 (eviction policies) |
| **A hot key overwhelming one node** | In a clustered deployment, one exceptionally popular key still lives on exactly one node — if it's read or written far more than others, that single node can become a bottleneck even though the cluster as a whole has spare capacity. | Phase 7 (Redis Cluster) |
| **Silently collapsing hit ratio** | Cache TTLs too short, or a working set that's outgrown available memory, cause more and more reads to fall through to the slower backing database — Redis "looks up" but stops actually helping. | Phase 10 (caching patterns) |

**Common mistakes:**
- Monitoring only uptime and CPU usage and never watching `keyspace_hits`/`keyspace_misses` or the slow log — a cache that's quietly become ineffective can look perfectly "healthy" by every metric except the one that actually matters.
- Treating a rising `mem_fragmentation_ratio` or a `maxmemory_policy` of `noeviction` on a cache-only instance as someone else's problem to notice later, rather than an active dashboard warning light.

**Interview angle:** "How would you know if a Redis instance in production was about to have a problem?" is a common systems/ops-adjacent interview question. Interviewers want to hear that you'd track memory versus `maxmemory`, the hit ratio from `keyspace_hits`/`keyspace_misses`, and the slow log — not just "check if it's up" — and that you understand *why* each of these specifically catches a failure mode that simple uptime checks miss.

---

## 6. Hands-On Exercises

### Exercise 1 — Compute a hit ratio from real INFO output

Against a running Redis instance (local or Docker, from Phase 1), run `redis-cli INFO stats` and locate `keyspace_hits` and `keyspace_misses`. Compute the hit ratio by hand using the formula shown above. Then run a handful of `GET` commands against keys that don't exist, re-run `INFO stats`, and confirm `keyspace_misses` increased by the expected amount.

### Exercise 2 — Trigger and inspect a slow command

Populate a Redis instance with a few thousand keys (a simple loop with `redis-py`'s `SET`), then run `redis-cli --scan` or a broad pattern match and observe timing. Run `redis-cli SLOWLOG GET 10` afterward and identify which command(s), if any, show up — and note the microsecond execution time reported for each entry.

### Exercise 3 — Design a monitoring checklist

Write a short checklist (5-8 items) of exactly which `INFO` fields and which additional commands (like `SLOWLOG GET`) you'd wire into an alerting system for a production Redis instance used as a cache. For each item, note what threshold or trend would make you concerned.

---

## 7. Interview Q&A

### Q1. What are the most important Redis metrics to monitor in production?

**Answer:** Memory usage relative to `maxmemory`, the cache hit ratio computed from `keyspace_hits` and `keyspace_misses`, `connected_clients`, and the slow log via `SLOWLOG GET`. Together these catch memory pressure, a degrading cache, connection leaks, and individually expensive commands — the failure modes that simple uptime/CPU monitoring misses entirely.

---

### Q2. How do you compute a Redis cache hit ratio, and why does it matter?

**Answer:** Hit ratio is `keyspace_hits / (keyspace_hits + keyspace_misses)`, both available from `redis-cli INFO stats`. It matters because a Redis cache can be "up" and responding normally while its hit ratio quietly collapses — meaning most reads are falling through to the slower backing database anyway, and the cache has stopped providing much benefit even though nothing looks broken.

---

### Q3. What does the Redis slow log show, and how do you inspect it?

**Answer:** The slow log is a rolling record of commands that took longer than a configurable microsecond threshold (`slowlog-log-slower-than`) to execute, each entry including a timestamp, execution time, and the command with its arguments. You inspect it with `redis-cli SLOWLOG GET n` (e.g. `SLOWLOG GET 10` for the 10 most recent entries), which is the fastest way to identify a specific expensive command hiding behind an overall latency symptom.

---

### Q4. Why is one enormous key dangerous in Redis, specifically?

**Answer:** Because Redis command execution is single-threaded (Phase 1), reading, writing, or deleting one very large value takes a proportionally long time — and during that time, no other client's commands can be processed at all. A single oversized key can therefore stall every other client on the instance, not just the client that touched that key.

---

### Q5. Why can a hot key still be a problem even in a Redis Cluster with plenty of total capacity?

**Answer:** Cluster sharding (Phase 7) distributes different keys across different nodes, but any single key still lives on exactly one node. If that one key is read or written far more often than others, the node holding it can become a bottleneck on its own, even while the cluster's aggregate memory and throughput capacity across all nodes looks completely fine.

---

> 🧠 **Memory hook:** "`INFO` and `SLOWLOG` are Redis's dashboard warning lights — check them before the engine seizes, not after."
