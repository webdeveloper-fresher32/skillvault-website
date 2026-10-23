# 01 — Strings

> A comprehensive reference covering Redis's simplest data structure — the String — including atomic counters, batching, TTL-in-one-call, and why `INCR` beats "read, modify, write" in application code.

---

## Table of Contents

1. [The Problem: A Single Value, Instantly Available](#1-the-problem-a-single-value-instantly-available)
2. [The Analogy: A Labeled Locker](#2-the-analogy-a-labeled-locker)
3. [How It Works: SET, GET, and Value+TTL in One Call](#3-how-it-works-set-get-and-valuettl-in-one-call)
4. [Atomic Counters: INCR, DECR, INCRBY](#4-atomic-counters-incr-decr-incrby)
5. [Batching Reads and Writes: MSET and MGET](#5-batching-reads-and-writes-mset-and-mget)
6. [Strings vs Application-Side Counters](#6-strings-vs-application-side-counters)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. The Problem: A Single Value, Instantly Available

The simplest possible thing you can ask any data store to do is: "remember this one value under this one name, and hand it back to me when I ask." No nesting, no relationships, no schema — just a key and a value. It sounds almost too basic to be interesting, but a huge share of real workloads boil down to exactly this:

- A page-view counter that increments on every request.
- A feature flag ("is checkout-v2 enabled?") checked on every single page load.
- A cached configuration value that would otherwise mean a database round-trip on every request.
- An idempotency token or a rate-limit counter — a raw number that many concurrent requests need to safely read and update.

That last case exposes the real problem: if you build a counter yourself by reading a value from a database, adding one in your application code, and writing it back, you've introduced a **race condition**. Two requests can both read the same starting value, both add one, and both write back the same result — silently losing one increment. Redis's String type, plus a handful of purpose-built commands, solves this cleanly.

---

## 2. The Analogy: A Labeled Locker

**Real-world analogy:** a Redis String is a **labeled locker** — one locker, one label (the key), one item inside (the value). You don't get compartments inside the locker, you don't get a list of items, just a single slot. Want to know what's inside? Read the label, open the locker, see the one thing stored there. Want to replace it? Swap out the one item.

This is deliberately the simplest possible model. Later lessons (Lists, Hashes, Sets, Sorted Sets) add structure *inside* the value — a Hash is like a filing folder with labeled tabs, a List is an ordered stack of trays. A String has none of that: it's one key, one value, nothing nested. That simplicity is exactly why it's also the fastest and most predictable structure to reach for.

---

## 3. How It Works: SET, GET, and Value+TTL in One Call

The core String commands:

- `SET key value` — store a value under a key, overwriting whatever was there before.
- `GET key` — retrieve the value, or `nil` if the key doesn't exist.
- `SET key value EX seconds` — set the value **and** an expiration in a single atomic call (equivalent to `SETEX key seconds value`, the older, still-supported form).
- `DEL key` — remove a key entirely.

```bash
redis-cli> SET greeting "hello"
OK
redis-cli> GET greeting
"hello"
redis-cli> SET session:temp "placeholder" EX 60
OK
redis-cli> TTL session:temp
(integer) 60
redis-cli> DEL greeting
(integer) 1
```

`redis-py` mirrors this directly:

```python
import redis

r = redis.Redis(host="localhost", port=6379, decode_responses=True)

r.set("greeting", "hello")          # True
print(r.get("greeting"))            # "hello"

r.set("session:temp", "placeholder", ex=60)   # True — value + 60s TTL, one call
print(r.ttl("session:temp"))        # 60 (approx, counting down)

r.delete("greeting")                # 1 — number of keys actually deleted
```

Note: `redis-py`'s `set()` returns `True` on success (not the literal string `"OK"` you see in `redis-cli` — the client translates Redis's `+OK` reply into a Python boolean for you).

---

## 4. Atomic Counters: INCR, DECR, INCRBY

Redis Strings that hold integers get a special superpower: commands that read the current value, do arithmetic, and write the result back **as a single atomic server-side operation** — no round trip to your application code in between.

- `INCR key` — add 1, return the new value.
- `DECR key` — subtract 1, return the new value.
- `INCRBY key amount` — add an arbitrary integer amount, return the new value.
- `DECRBY key amount` — subtract an arbitrary integer amount, return the new value.

```bash
redis-cli> SET page:views 0
OK
redis-cli> INCR page:views
(integer) 1
redis-cli> INCR page:views
(integer) 2
redis-cli> INCR page:views
(integer) 3
redis-cli> GET page:views
"3"
```

Notice `GET` returns the value back as a string (`"3"`), even though it was stored via arithmetic commands — Redis Strings are always text/bytes on the wire; `INCR` is just a command that happens to interpret and rewrite that text as an integer.

```python
r.set("page:views", 0)
r.incr("page:views")   # 1  (int — redis-py parses INCR's integer reply for you)
r.incr("page:views")   # 2
r.incr("page:views")   # 3
print(r.get("page:views"))   # "3" (str, because decode_responses=True)
```

**Why `INCR` is atomic and race-condition-safe:** because Redis is single-threaded for command execution (Phase 1), `INCR` runs as one indivisible step — read the current integer, add one, write it back — with no other command able to interleave in the middle. Compare that to doing `GET page:views` in your application, adding 1 in Python, then `SET page:views <new value>`: between your `GET` and your `SET`, another request could run the exact same sequence, and both would compute the same "old value + 1," with one increment silently lost. `INCR` closes that gap entirely because the read-modify-write happens inside Redis itself, not split across a network round trip.

---

## 5. Batching Reads and Writes: MSET and MGET

When you need to set or get several keys at once, `MSET`/`MGET` batch them into a single round trip instead of issuing one command per key:

- `MSET key1 value1 key2 value2 ...` — set multiple keys in one call.
- `MGET key1 key2 ...` — retrieve multiple keys in one call, returning `nil` for any that don't exist.

```bash
redis-cli> MSET user:1001:name "Alice" user:1001:plan "pro"
OK
redis-cli> MGET user:1001:name user:1001:plan user:1001:missing
1) "Alice"
2) "pro"
3) (nil)
```

```python
r.mset({"user:1001:name": "Alice", "user:1001:plan": "pro"})   # True
print(r.mget("user:1001:name", "user:1001:plan", "user:1001:missing"))
# ['Alice', 'pro', None]
```

`redis-py`'s `mget` returns a plain Python `list`, positionally matching the keys you asked for — a missing key comes back as `None` in that same position, not omitted from the list.

---

## 6. Strings vs Application-Side Counters

| | **Redis `INCR`** | **App-side "read, add, write"** |
|---|---|---|
| **Atomicity** | Guaranteed — single indivisible server-side operation | Not guaranteed — two round trips (`GET`, then `SET`) with a race window between them |
| **Concurrency safety** | Safe under any number of concurrent callers | Unsafe — concurrent callers can silently lose increments |
| **Network round trips** | One | Two (or more, with retry logic) |
| **Code complexity** | One line | Needs manual locking or optimistic-concurrency logic to be made safe |

**Common mistakes:**
- Implementing a counter as `GET` a value, add 1 in application code, then `SET` it back — this reintroduces the exact race condition `INCR` exists to eliminate.
- Assuming Redis Strings can only hold short text — a String can hold **binary data up to 512MB**, which is why they're also used to cache serialized objects, images, or any other blob, not just short human-readable text.
- Forgetting that `SET` on an existing key **overwrites the value outright** — there's no implicit merge; if you need to add to existing data instead of replacing it, you want `INCRBY`, `APPEND`, or a different data structure entirely (Lists/Hashes/Sets, covered next).

**Interview angle:** "How would you implement a thread-safe counter in Redis?" is a very common warm-up question, and the expected answer is `INCR`/`INCRBY`, plus an explanation of *why* it's safe — because Redis executes it as a single atomic operation on a single-threaded server, not because of any locking your application adds. Interviewers are listening for whether you understand that the atomicity comes from Redis's execution model, not from anything special about the counter itself.

---

## 7. Hands-On Exercises

### Exercise 1 — Build and verify an atomic counter

Using `redis-cli`, run `SET visits:home 0`, then run `INCR visits:home` five times. Predict the value before each call, then confirm with `GET visits:home`.

### Exercise 2 — Race condition, on paper

Write out, step by step, what happens if two separate `redis-py` scripts each run `current = int(r.get("visits:home")); r.set("visits:home", current + 1)` at nearly the same instant, both reading the same starting value. Compare the final counter value you'd expect against what five sequential `INCR` calls would produce.

### Exercise 3 — TTL'd value in one call vs two

Using `redis-py`, set a key with `r.set("temp:token", "abc123", ex=30)`. Then, separately, set another key with `r.set("temp:token2", "abc123")` followed by `r.expire("temp:token2", 30)`. Both end up with the same TTL — but explain in one sentence why the single-call version (`ex=30`) is preferable in an application that has many concurrent callers.

---

## 8. Interview Q&A

### Q1. What is the simplest Redis data type, and what can it store?

**Answer:** The String — a single key mapped to a single value. It can hold text, numbers, or arbitrary binary data up to 512MB, making it useful for anything from a simple counter to a serialized object or cached image.

---

### Q2. Why is `INCR` considered atomic, and why does that matter?

**Answer:** `INCR` reads the current integer value, adds one, and writes the result back as a single indivisible operation inside Redis's single-threaded execution model — no other command can run in between those steps. This matters because implementing the same logic in application code (`GET`, add one, `SET`) introduces a race window where two concurrent callers can both read the same value and both write back the same result, silently losing an increment.

---

### Q3. What's the difference between `SET key value EX 60` and `SETEX key 60 value`?

**Answer:** They're functionally equivalent — both set a value and a 60-second expiration atomically in one call. `SETEX` is the older, dedicated command; `SET ... EX ...` is the more modern, more flexible form since `SET` also supports other options like `NX` (only set if not exists) alongside the TTL.

---

### Q4. How would you fetch multiple unrelated String keys efficiently?

**Answer:** Use `MGET key1 key2 key3 ...` to fetch them all in a single round trip, instead of issuing a separate `GET` per key. `redis-py`'s `mget()` returns a list positionally matching the requested keys, with `None` in place of any key that doesn't exist.

---

### Q5. Does `GET` on a counter set via `INCR` return an integer or a string?

**Answer:** A string. Redis Strings are stored as text/bytes on the wire regardless of how they were written; `INCR`/`INCRBY` interpret and rewrite that text as an integer internally, but a plain `GET` always returns it as a string (e.g., `"3"`), which is why `redis-py` examples often show `int(r.get(key))` when the value is needed for further arithmetic in Python.

---

> 🧠 **Memory hook:** "One locker, one label, one item — and `INCR` is the locker checking its own contents and updating them itself, so nobody peeking from outside can ever catch it mid-swap."
