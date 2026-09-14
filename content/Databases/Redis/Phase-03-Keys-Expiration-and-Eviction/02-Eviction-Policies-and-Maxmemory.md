# 02 — Eviction Policies and Maxmemory

> A comprehensive reference covering how Redis behaves when it runs out of configured memory, the six built-in eviction policies, and how to configure and verify them.

---

## Table of Contents

1. [The Problem: Memory Is Finite](#1-the-problem-memory-is-finite)
2. [The Analogy: A Full Fridge](#2-the-analogy-a-full-fridge)
3. [Configuring Maxmemory](#3-configuring-maxmemory)
4. [The Six Eviction Policies](#4-the-six-eviction-policies)
5. [Setting and Verifying a Policy](#5-setting-and-verifying-a-policy)
6. [Comparison: All Six Policies Side by Side](#6-comparison-all-six-policies-side-by-side)
7. [Common Mistakes](#7-common-mistakes)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. The Problem: Memory Is Finite

Everything Redis stores lives in RAM, and RAM on any machine — however large — is a fixed, finite resource. If you use Redis purely as a system of record with no memory cap, you have to plan capacity like any database: provision enough memory for the data you intend to keep, forever, and grow the machine as that data grows.

But an enormous share of real-world Redis usage is as a **cache** sitting in front of a slower system of record — meaning the *authoritative* copy of the data lives elsewhere, and everything in Redis is, by design, disposable and re-derivable. In that world, a completely different question becomes urgent: **what should Redis do when it's been given a fixed memory budget and that budget is full, but a client wants to write one more key?**

Without an explicit answer to that question, the default behavior is to refuse the write outright — which, for a cache that's supposed to gracefully hold "the most useful subset of the data," is rarely what you actually want.

---

## 2. The Analogy: A Full Fridge

**Real-world analogy:** picture a refrigerator that's completely full. A grocery delivery arrives with more food. You have a choice: refuse the delivery entirely and send it back (nothing new gets in until you make room yourself), or make room by throwing something out first — maybe the oldest carton of milk, maybe whatever you use least often, maybe just something at random — so the new groceries fit.

**`maxmemory` is the fridge's size. An eviction policy is the rule for what gets thrown out to make room.** Redis's default rule, `noeviction`, is "refuse the delivery" — writes simply start failing once the fridge is full. Every other policy picks a specific rule for *what* to throw away instead, and Redis's job is to apply that rule consistently and automatically, without you manually clearing space.

---

## 3. Configuring Maxmemory

`maxmemory` sets the memory budget Redis is allowed to use for data (it can also be set permanently in `redis.conf`, but `CONFIG SET` lets you change it live without a restart):

```bash
redis-cli> CONFIG SET maxmemory 100mb
OK
```

By itself, `maxmemory` only defines the ceiling — it says nothing about what happens once that ceiling is hit. That behavior is controlled entirely by a separate setting: `maxmemory-policy`.

---

## 4. The Six Eviction Policies

Redis ships with six built-in eviction policies, split into two families:

- **`allkeys-*`** policies are willing to evict *any* key, whether or not it has a TTL set.
- **`volatile-*`** policies only ever evict keys that have a TTL set (`EXPIRE`/`SETEX`/etc. from the previous lesson) — keys with no expiration are always left alone.

| Policy | Evicts | Behavior when full |
|---|---|---|
| `noeviction` | Nothing | Returns an error on writes that would use more memory (reads still work) |
| `allkeys-lru` | Any key, least-recently-used first | Approximates evicting whatever hasn't been accessed in the longest time |
| `volatile-lru` | Only keys with a TTL, least-recently-used first | Same LRU logic, restricted to keys marked as expirable |
| `allkeys-lfu` | Any key, least-frequently-used first | Evicts whatever is accessed least often, regardless of recency |
| `volatile-lfu` | Only keys with a TTL, least-frequently-used first | Same LFU logic, restricted to expirable keys |
| `volatile-ttl` | Only keys with a TTL, soonest-to-expire first | Evicts keys that were going to disappear soonest anyway |
| `allkeys-random` | Any key, chosen at random | No tracking overhead, but no intelligence about what's "hot" |
| `volatile-random` | Only keys with a TTL, chosen at random | Same as above, restricted to expirable keys |

(That's eight named policies in Redis, commonly grouped and discussed as "the six kinds of eviction logic": no eviction, LRU, LFU, TTL-based, and random, each optionally scoped to all keys or only volatile ones.)

LRU (least-recently-used) and LFU (least-frequently-used) sound similar but answer different questions: LRU asks "how long ago was this touched?" while LFU asks "how often is this touched, period?" A key accessed constantly for an hour and then untouched for the last five minutes might survive under LFU (it's still "frequently used" overall) while looking like a good LRU eviction candidate (it hasn't been touched *recently*).

---

## 5. Setting and Verifying a Policy

```bash
redis-cli> CONFIG SET maxmemory 100mb
OK
redis-cli> CONFIG SET maxmemory-policy allkeys-lru
OK
redis-cli> CONFIG GET maxmemory-policy
1) "maxmemory-policy"
2) "allkeys-lru"
```

`CONFIG SET` returns `OK` on success. `CONFIG GET` returns the setting as a two-element list — the parameter name followed by its current value — which is how `redis-cli` displays any config lookup; in `redis-py`, the equivalent call (`r.config_get("maxmemory-policy")`) returns this as a dict, e.g. `{"maxmemory-policy": "allkeys-lru"}`.

---

## 6. Comparison: All Six Policies Side by Side

| Policy | Best fit when... |
|---|---|
| `noeviction` | Redis is a primary data store where losing any key silently would be unacceptable — you'd rather see write errors and fix capacity than lose data quietly |
| `allkeys-lru` | Redis is used purely as a cache, and "recently accessed" is a good proxy for "still useful" (the common default choice for cache workloads) |
| `volatile-lru` | Redis mixes cache-like keys (with TTLs) and permanent keys in the same instance, and only the cache-like ones should ever be evicted |
| `allkeys-lfu` | Access patterns are bursty or cyclical, and "used often overall" is a better signal of importance than "used most recently" |
| `volatile-ttl` | You'd rather evict things that were about to expire anyway, minimizing surprise for keys with a longer TTL still remaining |
| `*-random` | You need eviction with effectively zero bookkeeping overhead and don't need it to be "smart" about which key it picks |

---

## 7. Common Mistakes

- **Leaving the default `noeviction` policy on an instance used purely as a cache.** Once memory fills up, writes start failing outright with an out-of-memory error instead of Redis gracefully making room by evicting stale data — this often surfaces in production as a confusing wave of write failures that looks like an outage, when it's actually a missing config change.
- **Choosing an `allkeys-*` policy when some keys have no TTL and must never be evicted** (e.g. permanent configuration data mixed into the same instance as cache entries). `allkeys-lru`/`allkeys-lfu`/`allkeys-random` are willing to evict *any* key, TTL or not — in that mixed scenario, a `volatile-*` policy is the safer choice, since it guarantees permanent (no-TTL) keys are never touched by eviction.
- **Assuming eviction is a substitute for capacity planning.** Eviction policies decide gracefully *which* key to remove when memory is full — they don't prevent memory from filling up in the first place, and aggressive eviction on an undersized instance can mean a low effective cache hit rate because useful data keeps getting evicted almost as soon as it's written.

**Interview angle:** this is one of the most commonly asked practical Redis questions, because it tests whether a candidate understands Redis's *operational* behavior, not just its commands. A strong answer names all the policy families (noeviction, LRU, LFU, TTL, random; each `allkeys-*` or `volatile-*`), explains that `noeviction` is the default and why that surprises people who assume Redis-as-cache "just works" out of the box, and can articulate the `allkeys-*` vs `volatile-*` distinction concretely — not just recite the command names.

---

## 8. Hands-On Exercises

### Exercise 1 — Set and confirm a policy

Using `redis-cli`, run `CONFIG SET maxmemory 50mb`, then `CONFIG SET maxmemory-policy volatile-lru`, then confirm both with `CONFIG GET maxmemory` and `CONFIG GET maxmemory-policy`. Note the returned two-line format for each.

### Exercise 2 — Design a policy for a mixed workload

You have one Redis instance holding both permanent user-preference data (no TTL, must never be evicted) and short-lived page-render cache entries (all with a TTL). Write one paragraph justifying which of the six eviction policies is the correct choice, and one paragraph explaining what would go wrong if you picked `allkeys-lru` instead.

### Exercise 3 — LRU vs LFU scenario

Describe a concrete access pattern (in terms of which keys get read, how often, and when) where `allkeys-lru` and `allkeys-lfu` would evict a *different* key first. Explain why the two policies disagree given that same pattern.

---

## 9. Interview Q&A

### Q1. What is the default `maxmemory-policy`, and what does it do?

**Answer:** The default is `noeviction`. Once memory usage reaches the configured `maxmemory` limit, Redis stops accepting writes that would use additional memory and returns an error, while reads continue to work normally. It does not proactively evict anything.

### Q2. What's the difference between `allkeys-lru` and `volatile-lru`?

**Answer:** Both evict the least-recently-used key when memory is full, but `allkeys-lru` is willing to evict any key regardless of whether it has a TTL set, while `volatile-lru` only ever considers keys that have an expiration set — keys with no TTL are never evicted under `volatile-lru`.

### Q3. How is LFU different from LRU as an eviction strategy?

**Answer:** LRU (least-recently-used) evicts based on how long ago a key was last accessed, so a key untouched for a while looks like a good eviction candidate even if it was accessed heavily before that. LFU (least-frequently-used) evicts based on overall access frequency, so a key that's historically very "hot" can survive even through a temporary lull, which LRU alone wouldn't account for.

### Q4. Why would you choose `volatile-ttl` over `volatile-lru`?

**Answer:** `volatile-ttl` evicts keys that are closest to expiring anyway among those with a TTL set, which minimizes surprise — you're removing things that were about to disappear soon regardless. `volatile-lru` instead evicts based on access recency, which could remove a key with a long TTL remaining just because it hasn't been read in a while, even though it wasn't "due" to expire soon.

### Q5. What happens if you set `maxmemory` but never set `maxmemory-policy`?

**Answer:** `maxmemory-policy` defaults to `noeviction`, so once the configured memory limit is reached, Redis will start rejecting memory-increasing write commands with an error rather than evicting anything automatically — you have to explicitly opt into an eviction policy to get graceful, automatic eviction behavior.

---

> 🧠 **Memory hook:** "`maxmemory` is the fridge's size; the eviction policy is the rule for what gets thrown out to make room — and the factory-default rule is 'refuse the delivery,' not 'clear a shelf.'"
