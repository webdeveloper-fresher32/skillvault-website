# 01 — Key Naming and TTL

> A comprehensive reference covering consistent key-naming conventions, time-to-live (TTL) mechanics, and the commands that set, inspect, and remove expiration on a key.

---

## Table of Contents

1. [The Problem: A Flat Keyspace Turns Into a Junk Drawer](#1-the-problem-a-flat-keyspace-turns-into-a-junk-drawer)
2. [The Analogy: A Filing System vs a Junk Drawer](#2-the-analogy-a-filing-system-vs-a-junk-drawer)
3. [Key Naming Conventions](#3-key-naming-conventions)
4. [TTL: Making Keys Expire Automatically](#4-ttl-making-keys-expire-automatically)
5. [Setting TTL at Creation Time](#5-setting-ttl-at-creation-time)
6. [Comparison: The TTL-Related Commands](#6-comparison-the-ttl-related-commands)
7. [Common Mistakes](#7-common-mistakes)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. The Problem: A Flat Keyspace Turns Into a Junk Drawer

Redis has no built-in concept of tables, schemas, or namespaces — every single piece of data you store lives under one flat, global keyspace. That simplicity is part of what makes Redis fast and easy to reason about at small scale. But it's also exactly the problem: nothing stops you from mixing keys like `views`, `user_1001`, `sess-abc`, and `tmp2` in the same instance, with no consistent structure telling you what any of them mean, which service owns them, or whether they're safe to delete.

As an application grows — more features, more services, more engineers touching the same Redis instance — a flat keyspace with no naming discipline turns into a junk drawer: you can still find *something*, but you can no longer reason about what's safe to expire, what's safe to delete during a cleanup, or which team's data you might be stepping on. On top of that, most real-world Redis usage is temporary by nature — a session, a cache entry, a rate-limit counter — and if nothing ever expires, memory grows forever until Redis runs out and either starts erroring on writes or evicting data unpredictably (Phase 03's next lesson covers exactly that scenario).

The core problem this lesson solves: **how do you keep a large, flat keyspace understandable, and how do you make temporary data actually go away on its own?**

---

## 2. The Analogy: A Filing System vs a Junk Drawer

**Real-world analogy:** imagine two ways of storing paperwork. In the first, every document — receipts, contracts, warranty cards — gets tossed into one big drawer with no folders, no labels, no order. Finding anything later means digging through the whole pile, and you can never be quite sure if a piece of paper is safe to throw away or still important.

In the second, every document goes into a labeled folder inside a labeled drawer — `finance:2026:receipts`, `contracts:vendor-x`, `warranties:appliances` — and anything with a known shelf life (like a coupon) gets stamped with an expiration date so it can be cleared out automatically without anyone having to remember to do it.

**Colon-delimited key names are your folder labels. TTL is the expiration stamp.** Neither is enforced by Redis itself — there's no schema police — but both are conventions that keep a growing keyspace navigable and self-cleaning.

---

## 3. Key Naming Conventions

Redis doesn't understand hierarchy — to Redis, `user:1001:profile` is just one long string, no different from `xyz123`. The colon (`:`) is a *convention*, not a special character Redis parses, but it's the convention the whole Redis ecosystem (client libraries, GUIs like RedisInsight, monitoring tools) has converged on for representing hierarchy inside a flat keyspace.

A good naming pattern reads left-to-right from most general to most specific, similar to a file path:

```
<entity>:<id>:<field-or-subresource>

user:1001:profile
user:1001:sessions
session:abc123
cache:product:5001
rate-limit:login:203.0.113.7
```

This buys you two concrete things:
- **Human readability during debugging** — `SCAN` or `KEYS` output that reads `user:1001:profile` tells you immediately what it is, versus a bare `1001p`.
- **Pattern-based operations** — many tools (including `redis-cli --scan` and Redis's own `SCAN` command) support glob-style matching, so `user:1001:*` can find every key belonging to that one user, which becomes essential for cleanup and monitoring at scale.

---

## 4. TTL: Making Keys Expire Automatically

TTL — time-to-live — tells Redis "delete this key automatically once a certain amount of time has passed," without your application ever having to run a cleanup job. Internally, Redis stores an expiration timestamp alongside a key once one is set, and checks it lazily (when the key is accessed) and actively (a background sweep samples keys with a TTL set and removes any that have already passed their deadline) — combined, this means an expired key looks gone to any caller almost immediately, without a client needing to enforce it.

The core commands:

- **`EXPIRE key seconds`** — set a TTL, in seconds, on an existing key. Returns `1` if the timeout was set, `0` if the key doesn't exist.
- **`PEXPIRE key milliseconds`** — the same idea, with millisecond precision.
- **`TTL key`** — returns the remaining time to live in seconds. Returns `-1` if the key exists but has no TTL set (it never expires), and `-2` if the key doesn't exist at all.
- **`PTTL key`** — the same as `TTL`, but in milliseconds.
- **`PERSIST key`** — removes an existing TTL, making the key permanent again. Returns `1` if a TTL was removed, `0` if the key had no TTL to remove (or didn't exist).

```bash
redis-cli> SET page:views 0
OK
redis-cli> EXPIRE page:views 60
(integer) 1
redis-cli> TTL page:views
(integer) 60
redis-cli> PERSIST page:views
(integer) 1
redis-cli> TTL page:views
(integer) -1
```

---

## 5. Setting TTL at Creation Time

Setting a TTL as a second step right after `SET` works, but it leaves a small window where the key exists with no expiration at all — if your process crashes between the `SET` and the `EXPIRE`, that key is now permanent by accident. Redis lets you avoid that window entirely by setting the value and its expiration in one atomic command.

```bash
redis-cli> SET session:abc123 "user:1001" EX 1800
OK
redis-cli> TTL session:abc123
(integer) 1800
```

`SET key value EX seconds` sets the value and a TTL (in seconds) in a single atomic operation — there's also `PX milliseconds` for millisecond precision. The older, equivalent dedicated command is:

```bash
redis-cli> SETEX session:abc123 1800 "user:1001"
OK
```

`SETEX key seconds value` — note the argument order is *seconds before value*, the reverse of `SET ... EX`, which is a common source of confusion when switching between the two forms.

Putting it together — a 30-minute session, confirmed immediately, then made permanent:

```bash
redis-cli> SET session:abc123 "user:1001" EX 1800
OK
redis-cli> TTL session:abc123
(integer) 1800
redis-cli> PERSIST session:abc123
(integer) 1
redis-cli> TTL session:abc123
(integer) -1
```

Right after `SET ... EX 1800`, `TTL` reports `1800` (it hasn't had time to count down yet). After `PERSIST`, the key's expiration is cleared entirely and `TTL` reports `-1` — the key never expires again unless something sets a new TTL on it.

---

## 6. Comparison: The TTL-Related Commands

| Command | Purpose | Return value |
|---|---|---|
| `EXPIRE key seconds` | Set/replace TTL in seconds on an existing key | `1` if set, `0` if key doesn't exist |
| `PEXPIRE key ms` | Set/replace TTL in milliseconds | `1` if set, `0` if key doesn't exist |
| `TTL key` | Check remaining seconds until expiration | seconds remaining, `-1` no TTL, `-2` key missing |
| `PTTL key` | Check remaining milliseconds until expiration | milliseconds remaining, `-1` no TTL, `-2` key missing |
| `PERSIST key` | Remove TTL, make key permanent | `1` if a TTL was removed, `0` if none existed |
| `SET key value EX seconds` | Set value + TTL atomically in one step | `OK` |
| `SETEX key seconds value` | Same as above, dedicated older command (note: seconds comes before value) | `OK` |

---

## 7. Common Mistakes

- **Inconsistent key naming across a codebase** — one part of the app uses `user_1001`, another uses `user:1001:data`, another uses `u:1001`. This makes later debugging, monitoring, and pattern-based cleanup (`SCAN` with a glob pattern) far harder than it needs to be, since there's no single reliable pattern that matches "all keys belonging to this user."
- **Forgetting that a plain `SET` on an existing key wipes its expiration.** If `session:abc123` has a TTL and your application later runs a plain `SET session:abc123 "new-value"` (without `EX`/`PX`/`KEEPTTL`), the key becomes permanent — its TTL is silently discarded, not preserved. If you want to update a value without touching its TTL, use `SET key value KEEPTTL`.
- **Confusing `SETEX`'s argument order** — `SETEX key seconds value` puts seconds *before* the value, the opposite of `SET key value EX seconds`. Mixing these up is an easy way to accidentally pass a value where a TTL was expected.

**Interview angle:** interviewers often probe key-naming and TTL together because they reveal whether you actually understand Redis's operational model versus just knowing individual commands. A strong answer connects "no schema enforcement" to "naming conventions are a discipline you impose, not something Redis enforces," and connects TTL to memory management — most Redis-as-cache workloads should have *nothing* living forever by accident, which is precisely the gap eviction policies (next lesson) are designed to catch when TTLs alone aren't enough.

---

## 8. Hands-On Exercises

### Exercise 1 — Design a naming scheme

For an e-commerce app with users, shopping carts, product cache entries, and login rate limits, write out a consistent colon-delimited naming scheme for each of those four categories. Then write the `SCAN`-style glob pattern (e.g. `cart:*`) you'd use to find "every shopping cart currently in Redis."

### Exercise 2 — Watch a TTL count down

Using `redis-cli`, run `SET demo:ttl "hello" EX 20`, then run `TTL demo:ttl` a few times over the next 20 seconds. Note what `TTL` reports as the seconds count down, and what it reports once the key has expired (compare this to the `-2` "key doesn't exist" case versus the `-1` "no TTL set" case).

### Exercise 3 — KEEPTTL vs plain SET

Run `SET demo:keepttl "v1" EX 100`, confirm the TTL with `TTL demo:keepttl`, then run a plain `SET demo:keepttl "v2"` (no `EX`) and check `TTL demo:keepttl` again. Repeat the same sequence but use `SET demo:keepttl "v2" KEEPTTL` for the second write instead, and compare the two outcomes.

---

## 9. Interview Q&A

### Q1. Does Redis enforce any structure on key names, like namespaces or tables?

**Answer:** No. Redis has one flat, global keyspace, and every key is just a string to Redis internally. Colon-delimited naming like `user:1001:profile` is a widely-adopted convention, not a feature Redis parses or enforces — the discipline comes entirely from the application and its team.

### Q2. What's the difference between `TTL` returning `-1` and `-2`?

**Answer:** `-1` means the key exists but has no expiration set — it will live forever unless something later sets a TTL on it. `-2` means the key doesn't exist at all (either it was never set, or it already expired and was removed). Confusing these two is a common bug source when checking "is this key still alive."

### Q3. What happens to a key's TTL if you run a plain `SET` on it again?

**Answer:** A plain `SET key value` (without `EX`, `PX`, or `KEEPTTL`) removes any existing expiration, making the key permanent — even if it previously had a TTL. To update a value while preserving its existing TTL, use `SET key value KEEPTTL`.

### Q4. What's the difference between `SET key value EX 60` and `SETEX key 60 value`?

**Answer:** They're functionally equivalent — both set the value and a 60-second TTL atomically. The difference is purely syntactic: `SETEX` takes seconds before the value, while `SET ... EX` takes the value first, then `EX` and the seconds. `SET` with options is the more modern, flexible form since it also supports `NX`/`XX`/`PX`/`KEEPTTL` in the same command.

### Q5. Why does atomic "set value and TTL together" matter compared to calling `SET` then `EXPIRE` separately?

**Answer:** Calling them as two separate commands leaves a brief window where the key exists with no TTL at all — if the client crashes or the connection drops between the two calls, that key never expires, silently becoming permanent. Setting both in one atomic command (`SET ... EX` or `SETEX`) eliminates that window entirely.

---

> 🧠 **Memory hook:** "Colon-delimited names are your folder labels; TTL is the expiration stamp — neither is enforced by Redis, both are what keep a growing keyspace from becoming a junk drawer."
