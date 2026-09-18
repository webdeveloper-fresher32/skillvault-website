# 02 — Lists and Hashes

> A comprehensive reference covering Redis Lists (ordered sequences) and Hashes (single keys with multiple named fields), including queues, recent-activity feeds, and compact object storage.

---

## Table of Contents

1. [The Problem: When a Flat Value Isn't Enough](#1-the-problem-when-a-flat-value-isnt-enough)
2. [The Analogy: Cafeteria Trays and a Filing Folder](#2-the-analogy-cafeteria-trays-and-a-filing-folder)
3. [Lists: An Ordered Sequence You Push and Pop](#3-lists-an-ordered-sequence-you-push-and-pop)
4. [Hashes: One Key, Many Named Fields](#4-hashes-one-key-many-named-fields)
5. [Building a Recent-Searches List and a User-Profile Hash](#5-building-a-recent-searches-list-and-a-user-profile-hash)
6. [Comparison: List vs Hash vs Multiple String Keys](#6-comparison-list-vs-hash-vs-multiple-string-keys)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. The Problem: When a Flat Value Isn't Enough

A String is great for one value under one key — but plenty of real data doesn't look like that at all:

- **Order matters.** A "recent activity" feed, a task queue, a chat log — these are sequences where the order items arrived in is part of the data itself. A single String can't represent "the last 10 things that happened, in order."
- **One logical object has several fields.** A user profile has a name, an email, a signup date, a plan tier. You *could* store each as a separate String key (`user:1001:name`, `user:1001:email`, ...), but now one logical "user" is scattered across many keys with no single place to fetch or delete it as a unit.

Redis has two purpose-built structures for exactly these two shapes of problem: **Lists** for ordered sequences, and **Hashes** for a single object with multiple named fields.

---

## 2. The Analogy: Cafeteria Trays and a Filing Folder

**Real-world analogy for Lists:** picture a cafeteria line where trays get stacked as people finish — a new tray goes on the top or bottom of the stack, and people grab from either end. That's a Redis List: you `LPUSH` (push onto the left/head) or `RPUSH` (push onto the right/tail), and you `LPOP`/`RPOP` to take one off from either end. The order is preserved exactly as trays were stacked.

**Real-world analogy for Hashes:** picture a single filing folder labeled "Alice's Record," with labeled tabs inside it — one tab for "name," one for "email," one for "plan." It's one folder (one key) you can hand someone as a unit, but internally it has clearly labeled compartments (fields). That's a Redis Hash: one key, many named fields, all retrievable together or individually.

---

## 3. Lists: An Ordered Sequence You Push and Pop

Core List commands:

- `LPUSH key value [value ...]` — push one or more values onto the **left** (head) of the list; returns the list's new length.
- `RPUSH key value [value ...]` — push onto the **right** (tail); returns the new length.
- `LRANGE key start stop` — return a range of elements (0-indexed, `-1` means "last element").
- `LPOP key` / `RPOP key` — remove and return the leftmost/rightmost element (or `nil` if the list is empty).
- `LTRIM key start stop` — trim the list down to only the elements within that index range, discarding the rest.

```bash
redis-cli> LPUSH recent:searches "redis"
(integer) 1
redis-cli> LPUSH recent:searches "python"
(integer) 2
redis-cli> LPUSH recent:searches "docker"
(integer) 3
redis-cli> LRANGE recent:searches 0 -1
1) "docker"
2) "python"
3) "redis"
```

Notice the order: because each `LPUSH` inserts at the **head**, the most recently pushed item (`"docker"`) ends up first. Lists are commonly used as queues (`RPUSH` to add work, `LPOP` to take the oldest item first — first-in-first-out) or as recent-activity feeds (`LPUSH` new events, `LRANGE 0 N` to show the N most recent).

```python
r.lpush("recent:searches", "redis")     # 1
r.lpush("recent:searches", "python")    # 2
r.lpush("recent:searches", "docker")    # 3
print(r.lrange("recent:searches", 0, -1))
# ['docker', 'python', 'redis']
```

---

## 4. Hashes: One Key, Many Named Fields

Core Hash commands:

- `HSET key field value [field value ...]` — set one or more fields on the hash; returns the number of **new** fields added (fields that already existed and were merely updated don't count toward this number).
- `HGET key field` — get a single field's value (or `nil` if the field or key doesn't exist).
- `HGETALL key` — get every field and value in the hash.
- `HDEL key field [field ...]` — delete one or more fields; returns the number actually removed.

```bash
redis-cli> HSET user:1001 name "Alice" email "alice@example.com"
(integer) 2
redis-cli> HGET user:1001 name
"Alice"
redis-cli> HGETALL user:1001
1) "name"
2) "Alice"
3) "email"
4) "alice@example.com"
```

In `redis-cli`, `HGETALL` prints a flat alternating list of field, value, field, value. In `redis-py`, that same reply is parsed into a Python `dict` for you:

```python
r.hset("user:1001", mapping={"name": "Alice", "email": "alice@example.com"})   # 2
print(r.hget("user:1001", "name"))    # "Alice"
print(r.hgetall("user:1001"))
# {'name': 'Alice', 'email': 'alice@example.com'}
```

(`mapping=` here is `redis-py`'s way of passing a Python dict of field/value pairs to `HSET` in one call, instead of listing `"name", "Alice", "email", "alice@example.com"` as separate positional arguments.)

---

## 5. Building a Recent-Searches List and a User-Profile Hash

Putting a size cap on a list (so it doesn't grow forever) combines `LPUSH` with `LTRIM`:

```bash
redis-cli> LPUSH recent:searches "kubernetes"
(integer) 4
redis-cli> LTRIM recent:searches 0 2
OK
redis-cli> LRANGE recent:searches 0 -1
1) "kubernetes"
2) "docker"
3) "python"
```

`LTRIM recent:searches 0 2` keeps only indexes 0 through 2 (the 3 most recent items) and discards everything past that — `"redis"`, the oldest entry, is gone. Running `LPUSH` followed by `LTRIM` after every insert is the standard pattern for a capped "last N items" list.

For the user-profile Hash, once fields are set, the whole object can be fetched or removed as a unit:

```bash
redis-cli> HGETALL user:1001
1) "name"
2) "Alice"
3) "email"
4) "alice@example.com"
redis-cli> HDEL user:1001 email
(integer) 1
redis-cli> HGETALL user:1001
1) "name"
2) "Alice"
```

---

## 6. Comparison: List vs Hash vs Multiple String Keys

| | **List** | **Hash** | **Multiple String keys** |
|---|---|---|---|
| **Best for** | Ordered sequences — queues, recent-activity feeds, logs | One object, several named fields | Rarely the best fit for structured data |
| **Order preserved?** | Yes — insertion order | No inherent order among fields | N/A — unrelated keys |
| **Fetch whole object in one call?** | Yes, via `LRANGE 0 -1` | Yes, via `HGETALL` | No — one `GET` per key |
| **Memory efficiency for one logical object** | N/A (not the right shape) | Efficient — one key's overhead, not one per field | Wasteful — every key carries its own per-key overhead |
| **Delete whole object in one call?** | Yes, via `DEL` | Yes, via `DEL` | No — must `DEL` each key individually |

**Common mistakes:**
- Using a List as an unbounded queue or feed and never calling `LTRIM` — the list grows forever, quietly consuming more and more memory until it becomes a problem.
- Storing one logical object (like a user profile) as many separate String keys (`user:1001:name`, `user:1001:email`, `user:1001:plan`, ...) instead of one Hash — this wastes memory on per-key overhead multiplied across every field, and makes fetching or deleting "the whole user" require multiple round trips instead of one.

**Interview angle:** "When would you use a Hash instead of just storing JSON in a String?" is a common follow-up once someone knows both structures exist. The strong answer: a Hash lets you read or write **individual fields** (`HGET`, `HSET` on just one field) without pulling the entire object across the network and re-serializing it every time — a whole-object-as-JSON-String forces you to fetch, parse, modify, and rewrite the entire blob even to change one field.

---

## 7. Hands-On Exercises

### Exercise 1 — Capped recent-activity feed

Using `redis-cli`, `LPUSH` five different items onto a key called `feed:demo`, then run `LTRIM feed:demo 0 2` to cap it at 3. Confirm with `LRANGE feed:demo 0 -1` that only the 3 most recently pushed items remain, in the right order.

### Exercise 2 — Queue behavior with RPUSH/LPOP

Using `redis-py`, `RPUSH` three tasks (as strings) onto a key called `queue:demo`, then call `r.lpop("queue:demo")` three times. Confirm the tasks come back in the same order they were pushed (first-in-first-out), and explain why `RPUSH` + `LPOP` gives FIFO order while `LPUSH` + `LPOP` would give LIFO (stack) order instead.

### Exercise 3 — Profile as a Hash vs as separate keys

Store a small user profile (name, email, plan) two ways: once as three separate String keys, once as a single Hash. Write down the exact `redis-cli` commands needed to delete "the whole user" in each version, and count how many commands each approach requires.

---

## 8. Interview Q&A

### Q1. When would you choose a List over a Hash?

**Answer:** A List when the order of items matters and you're modeling a sequence — a queue, a recent-activity feed, a log — where you push and pop from either end. A Hash when you're modeling a single object with multiple named fields, like a user profile, where order among the fields doesn't matter but grouping them under one key does.

---

### Q2. What does `LPUSH` return, and what does that number represent?

**Answer:** `LPUSH` returns an integer: the length of the list *after* the push completes. It's not the position of the newly inserted item — it's simply the list's total size at that point, which is useful for confirming how many items are now in the list without a separate `LLEN` call.

---

### Q3. Why should a List used as a capped feed always be paired with `LTRIM`?

**Answer:** Without `LTRIM`, every `LPUSH`/`RPUSH` just keeps growing the list indefinitely — nothing in Redis automatically caps a List's size. Calling `LTRIM key 0 N-1` after each push keeps only the most recent N elements, discarding the rest, which is the standard way to bound memory usage for a "last N items" feed.

---

### Q4. What does `HGETALL` return in `redis-py`, and how does that differ from `redis-cli`'s output?

**Answer:** In `redis-cli`, `HGETALL` prints a flat, alternating list of field names and values. In `redis-py`, the client library parses that same reply into a Python `dict` mapping each field name to its value, which is more convenient to work with directly in application code.

---

### Q5. Why might storing a user profile as one Hash be better than storing it as several separate String keys?

**Answer:** A Hash groups all of a logical object's fields under a single key, so the whole object can be fetched (`HGETALL`) or deleted (`DEL`) in one call instead of many, and it avoids the per-key memory overhead that Redis incurs for every separate String key — multiplying that overhead across dozens of fields per object adds up at scale.

---

> 🧠 **Memory hook:** "A List is a stack of cafeteria trays — order matters, push and pop from either end. A Hash is one filing folder with labeled tabs inside — one key, many named fields, grab the whole folder or just one tab."
