# 02 — Serialization and Error Handling

> A comprehensive reference covering how to store real Python objects in Redis via serialization, the tradeoffs between `json` and `pickle`, and how to handle connection failures gracefully in application code.

---

## Table of Contents

1. [The Problem: Redis Stores Text and Bytes, Your App Has Objects](#1-the-problem-redis-stores-text-and-bytes-your-app-has-objects)
2. [The Analogy: Mailing a Couch](#2-the-analogy-mailing-a-couch)
3. [Internal Flow: Serialization Options](#3-internal-flow-serialization-options)
4. [Code Example: json.dumps/json.loads Round Trip](#4-code-example-jsondumpsjsonloads-round-trip)
5. [Handling Connection Errors with Retry and Backoff](#5-handling-connection-errors-with-retry-and-backoff)
6. [Comparison: json vs pickle vs a Hash](#6-comparison-json-vs-pickle-vs-a-hash)
7. [Common Mistakes](#7-common-mistakes)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. The Problem: Redis Stores Text and Bytes, Your App Has Objects

Every Redis String, Hash field, and List element ultimately holds text or raw bytes — Redis has no native concept of a Python `dict`, a `list` of objects, or a custom class instance. But application code is built out of exactly those things: a user profile is a `dict` with several fields, a shopping cart is a `list` of item objects, a cached API response is deeply nested JSON. Before any of that can be stored in Redis, it has to be converted into a flat string (or bytes) representation — and converted back into a usable Python object on the way out.

On top of that, Phase 01 already flagged that `redis-py` calls can raise `redis.exceptions.ConnectionError` when Redis is unreachable. Any real application making network calls — to Redis or anything else — has to assume those calls can fail, and decide what to do when they do: crash, retry, or degrade gracefully.

This lesson covers both halves of turning "code that talks to Redis in a tutorial" into "code that's safe to run in production": serializing real objects, and handling the network failures that will eventually happen.

---

## 2. The Analogy: Mailing a Couch

**Real-world analogy:** You can't post a couch through a mail slot. To ship it, you have to disassemble it into flat, packable pieces (serialize it), box each piece up, and hand it to a delivery service — and that delivery truck might break down, get delayed, or the address might be unreachable (a network error) before the package arrives. Serialization is the disassembly step; error handling is accepting that the delivery truck sometimes doesn't make it on the first try, and having a plan for that instead of assuming it always will.

---

## 3. Internal Flow: Serialization Options

There are two common ways to turn a Python object into something Redis can store as a String, plus a third option that sidesteps serialization for certain shapes of data entirely:

- **`json.dumps` / `json.loads`** — Python's built-in `json` module converts a `dict`, `list`, or combination of basic types (strings, numbers, booleans, `None`, nested dicts/lists) into a JSON-formatted string, and back. JSON is plain text, human-readable, and — importantly — not tied to Python at all: any other language's Redis client can read a JSON string written by a Python process, and vice versa. This makes it the right default choice for most application caching.
- **`pickle`** — Python's built-in `pickle` module can serialize almost *any* Python object, including custom class instances, in a way `json` can't (JSON only understands basic data types). The tradeoffs: pickled data is Python-specific binary data (a non-Python service can't read it), and — critically — **unpickling data is not safe if you don't fully trust its source**, since a crafted malicious pickle payload can execute arbitrary code during deserialization.
- **Using a Hash instead of serializing at all** — if the object is a flat structure (like a user profile with a handful of simple fields), Phase 02 already showed that a Redis Hash can store each field separately under one key (`HSET user:1001 name "Alice" email "alice@example.com"`). This avoids serialization/deserialization overhead entirely and lets you read or update a single field (`HGET user:1001 email`) without touching the whole object — but it only works cleanly for flat, non-nested data; a Hash field's *value* is still just a string, so a nested object inside a Hash field would need its own serialization anyway.

---

## 4. Code Example: json.dumps/json.loads Round Trip

```python
import json
import redis

r = redis.Redis(host="localhost", port=6379, decode_responses=True)

user = {"id": 1001, "name": "Alice", "roles": ["admin", "editor"]}

# Serialize the dict into a JSON string before storing it.
r.set("user:1001:profile", json.dumps(user))
# True

# Read it back — r.get() returns a plain string (decode_responses=True),
# which json.loads() parses back into a real Python dict.
raw = r.get("user:1001:profile")
print(raw)
# '{"id": 1001, "name": "Alice", "roles": ["admin", "editor"]}'

restored = json.loads(raw)
print(restored)
# {'id': 1001, 'name': 'Alice', 'roles': ['admin', 'editor']}
print(restored["name"])
# 'Alice'
```

Note that `json.dumps` turns the `dict` into a *string* — that's the only thing `r.set` ever stores, regardless of what Python object you started with. `json.loads` is the inverse: it parses a JSON string back into native Python types (here, a `dict` with a nested `list`).

---

## 5. Handling Connection Errors with Retry and Backoff

A minimal retry wrapper for a transient connection issue — a brief network blip or Redis restarting — might look like this:

```python
import time
import redis

def get_with_retry(r, key, max_attempts=3):
    for attempt in range(max_attempts):
        try:
            return r.get(key)
        except (redis.exceptions.ConnectionError, redis.exceptions.TimeoutError) as e:
            if attempt == max_attempts - 1:
                raise  # Out of retries — let the caller handle it.
            wait = 2 ** attempt  # Exponential backoff: 1s, 2s, 4s, ...
            print(f"Redis unavailable ({e}); retrying in {wait}s...")
            time.sleep(wait)
```

`range(max_attempts)` produces `0, 1, 2` for `max_attempts=3` — each loop iteration is one attempt. The `except (redis.exceptions.ConnectionError, redis.exceptions.TimeoutError) as e` clause catches either exception type (a tuple of exception classes matches any of them) and binds the caught exception object to `e` so it can be included in the log message. `2 ** attempt` (exponential backoff) means each retry waits longer than the last, giving a struggling Redis instance more time to recover rather than hammering it with immediate retries.

This is a simple hand-rolled example to illustrate the pattern; production systems often reach for a dedicated retry library, or `redis-py`'s own built-in retry configuration (passing a `Retry` object and a set of retryable exceptions when constructing the client), rather than reimplementing backoff logic by hand everywhere it's needed.

---

## 6. Comparison: json vs pickle vs a Hash

| Approach | Cross-language safe? | Handles nested/custom objects? | Security risk | Best fit |
|---|---|---|---|---|
| `json.dumps`/`json.loads` | Yes — plain text, any language can read it | Basic types only (dict/list/str/int/float/bool/None) | Low — parsing untrusted JSON can't execute code | Default choice for most cached objects |
| `pickle` | No — Python-only binary format | Yes — arbitrary Python objects, including custom classes | High — unpickling untrusted data can execute arbitrary code | Only for Python-only, fully-trusted internal data |
| Redis Hash (no serialization) | Yes — fields are plain strings | No — only flat, non-nested field structures | Low | Flat objects where you need to read/update individual fields without touching the whole object |

---

## 7. Common Mistakes

- **Using `pickle` to deserialize data from any source you don't fully control.** This is a real, well-known security vulnerability — a crafted pickle payload can execute arbitrary code the moment it's unpickled, not just produce garbage data. If there's any chance the cached data could be tampered with or come from a less-trusted process, `json` is the safe choice.
- **Not handling `r.get(key)` returning `None` before passing it to `json.loads`.** `json.loads(None)` raises a `TypeError` — a missing key must be checked for explicitly (`if raw is not None:`) before attempting to parse it, since a cache miss is a completely normal outcome, not an error.
- **Assuming a Redis call will always succeed and skipping error handling entirely.** Any network call can fail; code that doesn't catch `redis.exceptions.ConnectionError`/`TimeoutError` will crash the whole request instead of falling back to the underlying database or a stale-but-usable cached value.

**Interview angle:** "How would you cache a Python dict in Redis, and what would you watch out for?" is a common way interviewers check whether a candidate has actually shipped Redis-backed caching code. A strong answer names `json.dumps`/`json.loads` as the default, explains why `pickle` is risky for untrusted data, and — just as importantly — mentions handling `None` from a cache miss and catching connection errors, since those are the two things that quietly break "it works on my machine" code the first time it runs against a flaky network or an empty cache.

---

## 8. Hands-On Exercises

### Exercise 1 — Round-trip a nested object

Build a Python `dict` with at least one nested `list` and one nested `dict` inside it (e.g. an order with a list of line items, each a dict with `name` and `price`). Store it with `json.dumps` + `r.set`, read it back with `r.get` + `json.loads`, and confirm the restored object is equal to the original (`restored == original`).

### Exercise 2 — Guard against a None cache miss

Write a function `get_cached_user(r, user_id)` that calls `r.get(f"user:{user_id}:profile")`, checks whether the result is `None`, and only calls `json.loads` if it isn't — returning `None` directly otherwise. Call it with a `user_id` that was never cached and confirm it doesn't raise.

### Exercise 3 — Trigger and survive a connection error

Point a `redis.Redis` client at a port nothing is listening on (e.g. `port=6380`). Wrap a `get_with_retry`-style function (from this lesson) around a `GET` call with `max_attempts=2` and a short backoff, and confirm it retries once before ultimately raising `redis.exceptions.ConnectionError` (since nothing will ever start listening on that port in this exercise).

---

## 9. Interview Q&A

### Q1. Why can't you store a Python dict directly in a Redis String?

**Answer:** Redis Strings only store text or raw bytes — Redis has no native concept of a Python `dict` or any other language-specific object. The dict has to be serialized (commonly via `json.dumps`) into a string representation before `SET`, and deserialized (via `json.loads`) back into a dict after `GET`.

---

### Q2. What's the security risk with using `pickle` for Redis-cached data?

**Answer:** Unpickling data is not just deserialization — a maliciously crafted pickle payload can execute arbitrary code during the unpickling process. If there's any chance the cached data could originate from or be tampered with by an untrusted source, `pickle` introduces a real remote-code-execution risk, whereas parsing untrusted JSON with `json.loads` cannot execute code.

---

### Q3. What happens if you call `json.loads(None)`?

**Answer:** It raises a `TypeError`, since `json.loads` expects a string (or bytes/bytearray) argument, not `None`. Since `r.get(key)` returns `None` on a cache miss, application code must check for `None` explicitly before passing the result to `json.loads`.

---

### Q4. When would a Redis Hash be preferable to serializing a whole object into one String?

**Answer:** When the object is flat (no nested structures) and the application frequently needs to read or update individual fields — a Hash lets you `HGET`/`HSET` a single field without serializing/deserializing the entire object, which is both more efficient and avoids race conditions from read-modify-write cycles on the whole blob.

---

### Q5. What exceptions should be caught around a `redis-py` call, and why use exponential backoff on retry?

**Answer:** `redis.exceptions.ConnectionError` (Redis unreachable) and `redis.exceptions.TimeoutError` (a slow/unresponsive connection) are the two most common failure modes to handle. Exponential backoff (waiting progressively longer between retries) avoids hammering an already-struggling Redis instance with an immediate flood of retry attempts, giving it more time to recover between each try.

---

> 🧠 **Memory hook:** "You can't mail a couch — serialize with `json` before `SET`, check for `None` before `json.loads`, and always assume the delivery truck (the network) might not make it."
