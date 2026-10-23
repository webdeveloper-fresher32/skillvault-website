# DNS Caching and TTL — Complete Guide

## Table of Contents
1. [Why Caching Matters for DNS](#1-why-caching-matters-for-dns)
2. [TTL — What It Controls](#2-ttl--what-it-controls)
3. [Caching at Every Layer, Revisited](#3-caching-at-every-layer-revisited)
4. [DNS Propagation Delay Explained](#4-dns-propagation-delay-explained)
5. [Production Scenario — The Stale IP Problem](#5-production-scenario--the-stale-ip-problem)
6. [Planning a Safe DNS Cutover](#6-planning-a-safe-dns-cutover)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. Why Caching Matters for DNS

DNS resolution (Lesson 02) can take multiple hops through root, TLD, and authoritative servers — expensive if it happened on every single request. Caching is what makes DNS fast and scalable in practice: once a resolver, OS, or browser learns an answer, it can reuse that answer for a while **without asking anyone again**.

```
Without caching:
  Every single web request → full root → TLD → authoritative lookup
  = massive latency + massive load on global DNS infrastructure

With caching:
  First lookup: full chain (~50-200ms)
  Every subsequent lookup within TTL: served from a local cache (~0-20ms)
```

The tradeoff caching introduces is **staleness**: a cached answer might no longer reflect reality if the record changed after it was cached. TTL exists specifically to control that tradeoff.

---

## 2. TTL — What It Controls

**TTL (Time To Live)** is a value, in seconds, attached to every DNS record by whoever manages the authoritative zone. It tells every cache along the resolution chain: "you may reuse this answer for up to this many seconds before you must ask me again."

```
example.com.   3600   IN   A   93.184.216.34
               │
               └── TTL = 3600 seconds (1 hour)

Meaning: any resolver, OS, or browser that receives this answer may
serve it from cache for up to 1 hour without re-querying.
```

### How TTL Is Chosen

| TTL Value | Tradeoff | Typical Use |
|---|---|---|
| **Very low (30–300s)** | Fresh changes propagate fast, but far more DNS query volume, slightly higher average latency | Just before/during a planned cutover, active failover setups, records that change frequently |
| **Moderate (3600s / 1hr)** | Balanced — the common default | Most production A/CNAME records under normal, stable operation |
| **High (86400s / 24hr+)** | Excellent caching efficiency, minimal DNS query load | Records that almost never change: NS records, SOA, long-stable infrastructure |

```
┌──────────────────────────────────────────────────────────┐
│  Lower TTL  →  Fresher data, more DNS traffic, more load   │
│  Higher TTL →  Staler data (if changed), less DNS traffic  │
│                                                              │
│  There is no universally "correct" TTL — it's a deliberate │
│  choice based on how often you expect the record to change │
│  and how much staleness you can tolerate.                   │
└──────────────────────────────────────────────────────────┘
```

A critical detail: **TTL is set by the record's owner but honored voluntarily by every downstream cache.** A resolver, OS, or browser *should* respect it, but some heavily loaded public resolvers or misbehaving software occasionally cache longer than instructed — one more reason DNS cutovers should always be planned with margin.

---

## 3. Caching at Every Layer, Revisited

Lesson 02 covered the resolution chain; here's how TTL specifically applies to each cache layer:

```
Browser cache        → caches for up to TTL (often capped lower internally, e.g. Chrome ~60s)
        │
OS cache              → caches for up to TTL
        │
Recursive resolver    → caches for up to TTL (this is the layer serving the MOST other clients)
        │
Root / TLD servers    → don't cache individual domain answers (only delegate)
        │
Authoritative server  → defines the TTL; doesn't need to cache anything itself
```

The recursive resolver is the layer that matters most for propagation: it serves potentially thousands of other users, so as long as *any* recursive resolver out there has your old answer cached, some subset of the world will keep seeing the old IP until that specific cache's TTL expires — independently of your own browser or OS.

---

## 4. DNS Propagation Delay Explained

"DNS propagation" is a slightly misleading term — DNS doesn't broadcast changes outward. Instead, a change takes effect for a given cache **only once that cache's existing TTL naturally expires** and it re-queries the authoritative server.

```
Myth: "DNS propagation is like a wave spreading across the internet
       over 24-48 hours."

Reality: The change is INSTANT at the authoritative server. What
         varies is when each of millions of independent caches
         WORLDWIDE happens to expire their old cached copy and
         ask again.
```

```
Timeline of a DNS change with TTL = 3600 (1 hour):

  t=0        You update the A record at your authoritative server.
             (The new value is immediately correct and available.)

  t=0 to 1hr Any resolver/OS/browser that cached the OLD value
             BEFORE t=0 keeps serving the OLD value until its own
             individual TTL countdown reaches zero.

  t=0+       Any resolver querying for the FIRST TIME (no cache yet)
             gets the NEW value immediately.

  t=1hr+     Every cache that had the old value has now expired it
             and will fetch the new value on next lookup.
```

So "propagation delay" is really just **the maximum remaining TTL of the slowest-to-expire cache anywhere in the world** — which is why lowering TTL in advance is the single most effective way to reduce it.

---

## 5. Production Scenario — The Stale IP Problem

This is one of the most common real-world DNS incidents, and a frequent interview scenario.

```
Setup:
  api.example.com   A   203.0.113.10   TTL=86400 (24 hours)

  This has been stable for months. Thousands of resolvers worldwide
  have cached "203.0.113.10" with a fresh 24-hour TTL at various times.

Incident:
  10:00 AM — Team migrates api.example.com to a new server: 203.0.113.99
  10:01 AM — Team updates the A record at the authoritative DNS provider.
  10:02 AM — Old server (203.0.113.10) is decommissioned/shut down.

Result:
  Users whose resolver cached the OLD record recently (e.g., at 9:45 AM,
  with a fresh 24hr TTL) will keep getting 203.0.113.10 until roughly
  9:45 AM the NEXT DAY — and now that IP is DEAD. Their requests time out
  or connection-refuse, even though "the DNS is already fixed."
```

```
Why this looks so confusing to the team:
  - `dig api.example.com` from THEIR machine shows the NEW IP
    (their own resolver has no stale cache, or they flushed it)
  - But support tickets pour in from users still hitting the old IP
  - It LOOKS like "DNS isn't propagating," but really: it's working
    exactly as designed — thousands of independent caches around the
    world are each running out their own, pre-existing TTL countdown
```

The root cause of the outage isn't DNS "being slow" — it's that the team decommissioned the old server **before** the old TTL (24 hours) had any chance to fully expire everywhere.

---

## 6. Planning a Safe DNS Cutover

The fix is to plan the TTL *before* the change, not react to it after. A safe cutover generally looks like this:

```
Phase 1 (well before cutover, e.g. 24-48hrs prior):
  Lower the TTL on the record you're about to change.
    api.example.com   A   203.0.113.10   TTL=86400  →  TTL=60
  Wait for the OLD (long) TTL to fully expire everywhere first —
  otherwise lowering the TTL itself won't take effect quickly.

Phase 2 (cutover day):
  Update the record to point at the new IP.
    api.example.com   A   203.0.113.99   TTL=60
  Because TTL is now low (60s), caches worldwide pick up the new
  value within about a minute of their next lookup.

Phase 3 (keep BOTH servers running, in parallel):
  Do NOT decommission the old server (203.0.113.10) immediately.
  Keep it running and reachable for at least one full old-TTL window
  plus a safety margin (e.g., several hours to a day), so any
  straggling caches that haven't picked up the change yet still get
  a working response.

Phase 4 (after the safety window has fully passed):
  Confirm via monitoring/logs that traffic to the old server has
  dropped to ~zero, THEN decommission it.

Phase 5 (optional, after cutover is verified stable):
  Raise the TTL back up to a normal value (e.g., 3600) to reduce
  ongoing DNS query load.
```

```
┌───────────────────────────────────────────────────────────┐
│  The golden rule of a DNS cutover:                          │
│                                                                │
│  Never decommission the OLD destination until AT LEAST the   │
│  old TTL's worth of time has passed since the record change  │
│  (and ideally with extra safety margin on top).               │
└───────────────────────────────────────────────────────────┘
```

This same pattern applies to any DNS-based migration: moving to a new hosting provider, switching CDNs, changing mail servers (MX), or failing traffic over to a disaster-recovery site.

---

## 7. Hands-On Exercises

**Exercise 1:** Run `dig example.com` against a real domain and note the TTL in the `ANSWER SECTION`. Run it again a few seconds later and observe whether the TTL value has counted down (this reveals how long ago your resolver cached it).

**Exercise 2:** Pick a domain and check its current TTL with `dig <domain> A`. Calculate the worst-case propagation delay if that record's IP were changed right now.

**Exercise 3:** Write out, step by step, the cutover plan (Section 6) for migrating `shop.example.com` from an old server to a new one, assuming the current TTL is 4 hours (14400s). Include specific relative timings for each phase.

**Exercise 4:** Explain (in 3-4 sentences, as if to a non-technical teammate) why "I already updated the DNS record, why do some users still see the old site?" is expected behavior rather than a bug.

**Exercise 5:** Using `dig +trace`, identify the TTL returned by the authoritative server directly (the last hop in the trace) versus what a cached lookup through your default resolver returns — explain why these numbers might differ (the cached copy's remaining TTL counts down from the original value).

---

## 8. Interview Q&A

**Q: What does TTL control in DNS, and who sets it?**
Answer: TTL (Time To Live) is a value in seconds attached to a DNS record by the domain's authoritative DNS administrator. It tells every downstream cache (recursive resolver, OS, browser) the maximum time they're allowed to reuse that cached answer before they must query the authoritative server again. It's a deliberate tradeoff: lower TTL means fresher data at the cost of more DNS query volume; higher TTL means better caching efficiency at the cost of slower propagation if the record changes.

**Q: Explain what "DNS propagation delay" actually is, technically.**
Answer: It's not a wave of change spreading across the internet — the authoritative server's answer is updated instantly. The delay is caused by the many independent caches worldwide (recursive resolvers, OS caches, browser caches) that had already cached the OLD value before the change and won't re-query until their own individual TTL countdown expires. The maximum possible propagation delay is bounded by the TTL that was in effect on the OLD record before it was changed.

**Q: A team changes a DNS record's IP and immediately shuts down the old server, but many users still get connection errors for hours. What went wrong?**
Answer: The old record likely had a long TTL (e.g., 24 hours), meaning many resolvers worldwide had already cached the old IP with a full TTL countdown still remaining. When the old server was decommissioned immediately instead of being kept alive for at least the duration of the old TTL, any client whose cache hadn't yet expired kept trying to reach an IP that no longer had anything listening — producing failures that look like a DNS problem but are actually a premature-decommission problem.

**Q: How would you plan a DNS cutover to minimize user-facing impact?**
Answer: Lower the record's TTL well in advance of the cutover (and wait for the old, longer TTL to fully expire first, so the TTL reduction itself takes effect). On cutover day, update the record to the new value — the now-low TTL means caches pick it up quickly. Critically, keep the OLD destination running and reachable for at least one full old-TTL window plus a safety margin after the change, so stragglers that haven't picked up the new record yet still get a valid response. Only decommission the old server after confirming via monitoring that traffic to it has dropped to near zero.

**Q: Why might lowering a record's TTL right before a change not have the intended effect if done too late?**
Answer: Because the TTL reduction is itself just another version of the record, subject to the OLD TTL that was in effect before you changed it. If the previous TTL was 24 hours, some caches may hold onto the old (long) TTL value for up to 24 hours before they even notice the TTL was lowered — meaning the actual cutover should be planned to happen only after that old TTL window has fully elapsed, not immediately after lowering it.

**Q: What's the difference between where TTL applies at the recursive resolver versus the browser/OS cache, in terms of real-world impact?**
Answer: The recursive resolver's cache has the largest real-world impact because it's shared across potentially thousands of end users (an entire ISP's customer base, or everyone using a public resolver like 8.8.8.8) — a single stale resolver cache affects many people at once. Browser and OS caches are scoped to a single device, so their staleness only affects that one user, and they're typically much shorter-lived in practice.
