# 03 — Connecting from Python

> A comprehensive reference covering how to install and use `redis-py`, the `decode_responses` option, and the common connection mistakes to watch for when talking to Redis from application code.

---

## Table of Contents

1. [The Problem: Real Applications Need a Client Library](#1-the-problem-real-applications-need-a-client-library)
2. [The Analogy: A Phone Call vs an API](#2-the-analogy-a-phone-call-vs-an-api)
3. [Installing redis-py and Creating a Client](#3-installing-redis-py-and-creating-a-client)
4. [decode_responses and Why It Matters](#4-decode_responses-and-why-it-matters)
5. [A First redis-py Session](#5-a-first-redis-py-session)
6. [Common Mistakes](#6-common-mistakes)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. The Problem: Real Applications Need a Client Library

`redis-cli`, from the previous lesson, is fantastic for interactive exploration — but it's a human-facing tool. A real application (a web backend, a background worker, a data pipeline) needs to talk to Redis *from code*, integrated into its own logic: reading a cached value inside a request handler, incrementing a counter as part of a larger function, reacting to a Pub/Sub message in a running process. That requires a **client library** — a package that opens and manages the network connection to Redis and translates your programming language's function calls into the same commands `redis-cli` sends under the hood, then translates Redis's replies back into native values your code can use directly.

For Python, that library is **`redis-py`** (the `redis` package on PyPI, and also the officially maintained client) — it is what every code example for the rest of this course will build on.

---

## 2. The Analogy: A Phone Call vs an API

**Real-world analogy:** `redis-cli` is like picking up the phone and talking to a customer service representative directly — you speak in plain sentences, they interpret and respond, and it works great for a single ad-hoc question. A client library like `redis-py` is like that same company exposing a proper API: instead of a human interpreting free-form speech every time, you call a well-defined function (`get_account_balance(account_id)`) and get back a structured, predictable response your own code can use directly, at whatever volume your application needs, without a human (or a person retyping CLI commands) in the loop.

You still need to understand the underlying "conversation" (the actual Redis commands) to use the API well — which is exactly why Phase 01-02's `redis-cli` exploration comes first.

---

## 3. Installing redis-py and Creating a Client

Install the package:

```bash
pip install redis
```

Then, in Python, create a client instance pointing at your Redis server:

```python
import redis

r = redis.Redis(host="localhost", port=6379, decode_responses=True)
```

This `Redis` object is your entry point for every command — each Redis command maps to a same- (or similar-) named method: `r.set(...)` for `SET`, `r.get(...)` for `GET`, `r.incr(...)` for `INCR`, and so on. Creating this object does not necessarily open a network connection immediately — `redis-py` lazily connects (and reconnects) as needed via an internal connection pool, which is covered in depth in Phase 11.

---

## 4. decode_responses and Why It Matters

Redis itself stores and returns raw bytes — it has no built-in concept of a Python string versus a Python bytes object; that's purely a client-side (Python-side) concern. By default, `redis-py` hands you back **raw `bytes` objects** for anything that isn't a plain integer, which means without any configuration:

```python
>>> r.set("foo", "bar")
True
>>> r.get("foo")
b'bar'
```

Notice the `b` prefix — that's Python's bytes literal notation, and it's easy to trip over if you're expecting a plain string. Passing `decode_responses=True` when constructing the client tells `redis-py` to automatically decode byte replies into regular Python `str` objects using UTF-8, so the exact same calls instead return:

```python
>>> r.set("foo", "bar")
True
>>> r.get("foo")
'bar'
```

For the overwhelming majority of application code — where you're storing and reading text, not raw binary data — `decode_responses=True` is the right default to reach for, and every example in this course assumes it's set.

---

## 5. A First redis-py Session

Putting it together — connect, write, read, and confirm the connection is alive:

```python
import redis

r = redis.Redis(host="localhost", port=6379, decode_responses=True)

print(r.ping())          # True
print(r.set("foo", "bar"))  # True
print(r.get("foo"))          # 'bar'
```

A few return-value details worth being precise about, since they differ slightly from what `redis-cli` shows:
- `r.ping()` returns the Python boolean `True` (not the string `"PONG"` you saw in `redis-cli` — `redis-py` translates Redis's `PONG` status reply into `True` for convenience).
- `r.set("foo", "bar")` returns `True` on success (again, `redis-py` translates Redis's `OK` status reply into the boolean `True`, rather than handing back the literal string).
- `r.get("foo")` returns `'bar'` — a plain `str`, because `decode_responses=True` was set. If the key didn't exist, `r.get(...)` would return Python's `None`, mirroring the `(nil)` you saw in `redis-cli`.

If Redis isn't reachable at all (wrong host/port, server not running), these calls don't hang forever or return a quiet falsy value — they raise `redis.exceptions.ConnectionError`, which application code should be prepared to catch (Phase 11 covers retry/backoff strategies for this in depth).

A brief forward-reference: the single `redis.Redis(...)` client shown here is fine for a short script, but a real multi-request web application shares connections across requests using a `redis.ConnectionPool` instead of opening a fresh connection every time — that's covered fully in Phase 11.

---

## 6. Common Mistakes

- **Forgetting `decode_responses=True` and being confused by `b'bar'` output.** Without it, every string reply comes back as `bytes`, which silently breaks string operations, JSON parsing, or string comparisons downstream (`b'bar' == 'bar'` is `False` in Python) until someone notices the stray `b` prefix.
- **Not handling `redis.exceptions.ConnectionError`.** If Redis is down, restarting, or unreachable due to a network issue, every call raises this exception — code that assumes Redis is always available will crash unhandled instead of degrading gracefully (e.g. falling back to the underlying database, or returning a cached-but-stale value).
- **Treating `r.get(...)` returning `None` as an error.** `None` from a missing key is normal, expected behavior, not a failure — conflating "key doesn't exist" with "something went wrong" leads to unnecessary error handling or, worse, swallowed real errors.

**Interview angle:** "What's the difference between using `redis-cli` and a client library like `redis-py` in production code, and what does `decode_responses` do?" tests whether a candidate has actually written Redis-backed code, not just read about Redis conceptually. A strong answer mentions the `bytes` vs `str` distinction specifically, since it's the single most common first stumbling block for anyone new to `redis-py`.

---

## 7. Hands-On Exercises

### Exercise 1 — bytes vs str, side by side

With a Redis server running, create two clients in the same Python session — one with `decode_responses=True` and one without (the default). Use both to `SET` and then `GET` the same key, and print the result from each. Confirm for yourself that one returns `bytes` (with a `b'...'` prefix) and the other returns a plain `str`.

### Exercise 2 — Trigger and catch a ConnectionError

Stop your Redis server (or point a client at a wrong port, e.g. `port=6380` where nothing is listening). Attempt `r.ping()` and observe the `redis.exceptions.ConnectionError` it raises. Wrap the call in a `try`/`except redis.exceptions.ConnectionError` block and print a friendly message instead of letting the exception crash the script.

### Exercise 3 — Round-trip a counter

Using `redis-py`, run `r.set("visits", 0)`, then call `r.incr("visits")` three times in a loop (a `for _ in range(3):` loop — the `_` is a conventional throwaway variable name used when the loop variable itself isn't needed). Print `r.get("visits")` at the end and confirm it shows `'3'` as a string (Redis Strings that hold integers are still returned as strings by `GET`/`r.get`, even though commands like `INCR` treat them numerically internally).

---

## 8. Interview Q&A

### Q1. What does `decode_responses=True` do, and why is it commonly used?

**Answer:** By default, `redis-py` returns raw `bytes` objects for string replies from Redis, since Redis itself has no concept of text encoding — it just stores bytes. Setting `decode_responses=True` when creating the client tells `redis-py` to automatically decode those bytes into regular Python `str` objects using UTF-8, which is what most application code expects when working with text data.

---

### Q2. What does `r.ping()` return in `redis-py`, and how does that differ from `redis-cli`?

**Answer:** `r.ping()` returns the Python boolean `True` on success. This differs from `redis-cli`, which prints the literal string `PONG` — `redis-py` translates Redis's status replies (`PONG`, `OK`) into Python booleans for convenience rather than handing back the raw reply text.

---

### Q3. What happens if you call `r.get()` on a key that doesn't exist?

**Answer:** It returns Python's `None`, mirroring the `(nil)` reply seen in `redis-cli`. This is normal, expected behavior for a missing key, not an error condition, and code should check for `None` explicitly rather than treating it as a failure.

---

### Q4. What exception should application code handle when Redis is unreachable?

**Answer:** `redis.exceptions.ConnectionError` (and potentially `redis.exceptions.TimeoutError` for slow/unresponsive connections). Application code that talks to Redis should be prepared to catch these rather than assuming Redis is always available, since a network blip or a restarting Redis process will surface as this exception.

---

### Q5. Is it efficient to create a new `redis.Redis(...)` client for every request in a web application?

**Answer:** No — that's an anti-pattern covered fully in Phase 11. A single client (or, more precisely, a single `redis.ConnectionPool` shared across the application) should be created once at startup, with individual requests borrowing connections from that shared pool rather than each opening a brand-new connection.

---

> 🧠 **Memory hook:** "`redis-cli` is the phone call; `redis-py` is the API — and don't forget `decode_responses=True` or you'll be staring at `b'bar'` wondering where the `b` came from."
