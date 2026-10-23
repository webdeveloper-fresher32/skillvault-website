# 03 — Streams

> A comprehensive reference covering Redis Streams — an append-only, ordered log built for multiple independent consumers and history replay.

---

## Table of Contents

1. [The Problem: An Event Log Multiple Consumers Need to Share](#1-the-problem-an-event-log-multiple-consumers-need-to-share)
2. [The Analogy: A Shared Logbook With Individual Bookmarks](#2-the-analogy-a-shared-logbook-with-individual-bookmarks)
3. [Internal Flow: Appending and Reading Entries](#3-internal-flow-appending-and-reading-entries)
4. [Internal Flow: Consumer Groups](#4-internal-flow-consumer-groups)
5. [Code Example: A Sensor Reading Stream](#5-code-example-a-sensor-reading-stream)
6. [Streams vs Lists vs Pub/Sub](#6-streams-vs-lists-vs-pubsub)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. The Problem: An Event Log Multiple Consumers Need to Share

Some data is naturally an ever-growing, ordered sequence of events rather than a single value: sensor readings arriving every few seconds, an activity feed, orders coming into a processing pipeline. Two requirements make this harder than it first sounds:

- **Multiple independent consumers** may need to read the same feed — an analytics job, a real-time dashboard, and an alerting system might all need to process the same sensor readings, each at its own pace.
- **History matters** — a consumer that was briefly offline shouldn't just lose everything that happened while it was down; it should be able to pick up where it left off, or replay from any point.

Neither a plain List (Phase 2) nor Pub/Sub (Phase 9) satisfies both requirements at once: a List has no built-in concept of "multiple readers, each with their own position," and Pub/Sub delivers messages live with zero history — miss it live, and it's gone forever. Redis **Streams** are purpose-built to solve exactly this.

---

## 2. The Analogy: A Shared Logbook With Individual Bookmarks

**Real-world analogy:** picture a shared logbook sitting on a desk. Every new entry gets written at the bottom with an automatic timestamp, and the log only ever grows — nothing already written is erased. Multiple people can read this same logbook, and each reader keeps their *own* bookmark of how far they've read, independent of everyone else's bookmark. One reader being slow, or stepping away for a while, doesn't erase entries or block anyone else from reading — when they come back, their bookmark is still exactly where they left it.

That's a Redis Stream: an append-only log where every entry gets an automatically generated, strictly increasing ID (a timestamp-based marker), and multiple independent readers (or, as covered below, coordinated *groups* of readers) can each track their own position without interfering with each other.

---

## 3. Internal Flow: Appending and Reading Entries

- **`XADD key ID field value [field value ...]`** — appends a new entry to the stream. Passing `*` as the ID tells Redis to auto-generate one, in the form `<milliseconds-since-epoch>-<sequence-number>` (the sequence number disambiguates multiple entries added within the same millisecond). Returns the ID that was assigned.
- **`XRANGE key start end`** — reads entries between two IDs, inclusive. The special IDs `-` and `+` mean "the smallest possible ID" and "the largest possible ID," so `XRANGE key - +` reads the entire stream from the beginning.
- **`XREAD [COUNT n] STREAMS key id`** — reads entries with an ID greater than the one given, optionally blocking (`BLOCK ms`) to wait for new entries to arrive if none exist yet.

Each entry is itself a small flat set of field/value pairs — similar in shape to a Hash — so one `XADD` call can carry several named fields (e.g. `reading`, `sensor_id`, `unit`) as one atomic entry.

---

## 4. Internal Flow: Consumer Groups

Reading with `XREAD` alone gives you replay and ordering, but not *coordination* between multiple consumers working through the same backlog without duplicating effort. **Consumer groups** add that:

- **`XGROUP CREATE key group id [MKSTREAM]`** — creates a named consumer group on a stream, starting from a given ID (often `$`, meaning "only new entries from now on"). `MKSTREAM` creates the stream itself if it doesn't already exist.
- **`XREADGROUP GROUP group consumer [COUNT n] STREAMS key >`** — a named consumer within the group claims the next batch of unread entries. The special ID `>` means "entries never yet delivered to any consumer in this group." Redis guarantees each such entry is handed to exactly one consumer in the group — no two consumers race for the same entry.
- **`XACK key group id [id ...]`** — marks an entry as successfully processed, removing it from the group's *pending entries list* (the list of delivered-but-unacknowledged entries).
- **`XPENDING key group`** — inspects entries that were delivered to a consumer but never acknowledged, useful for spotting a consumer that crashed mid-processing.

This is the mechanism that makes Streams a genuine message-queue building block — covered in more depth as a durable Pub/Sub alternative in Phase 9 — rather than just a log you can only read serially.

---

## 5. Code Example: A Sensor Reading Stream

Appending two temperature readings, letting Redis auto-generate each ID with `*`:

```
127.0.0.1:6379> XADD sensor:temp * reading 22.5
"1721923200000-0"
127.0.0.1:6379> XADD sensor:temp * reading 23.1
"1721923201000-0"
```

(The exact numeric IDs depend on the millisecond each command actually runs — the pattern `<epoch-ms>-<sequence>` is what matters, and the second ID will always be numerically greater than the first, which is what guarantees ordering.)

Reading the whole stream back with `XRANGE`:

```
127.0.0.1:6379> XRANGE sensor:temp - +
1) 1) "1721923200000-0"
   2) 1) "reading"
      2) "22.5"
2) 1) "1721923201000-0"
   2) 1) "reading"
      2) "23.1"
```

Each entry in the reply is a two-element array: the entry's ID, followed by a flat list alternating field names and values — the same shape `HGETALL` uses for Hashes.

**Python (`redis-py`) equivalent, including a consumer group:**

```python
import redis

r = redis.Redis(host="localhost", port=6379, decode_responses=True)

r.xadd("sensor:temp", {"reading": "22.5"})
r.xadd("sensor:temp", {"reading": "23.1"})

# XRANGE: read the full stream, "-" to "+" means the entire ID range
entries = r.xrange("sensor:temp", min="-", max="+")
print(entries)
# [('1721923200000-0', {'reading': '22.5'}), ('1721923201000-0', {'reading': '23.1'})]

# Consumer group: create it, starting only from new entries ("$")
r.xgroup_create("sensor:temp", "processors", id="$", mkstream=True)

# A named consumer claims new entries; ">" means "not yet delivered to this group"
new_entries = r.xreadgroup("processors", "consumer-1", {"sensor:temp": ">"}, count=10)

# Acknowledge each entry once processed
for stream_name, stream_entries in new_entries:
    for entry_id, fields in stream_entries:
        r.xack("sensor:temp", "processors", entry_id)
```

`r.xrange(...)` returns a list of tuples — each tuple pairing an entry ID (a string) with a dict of that entry's fields — and the `for stream_name, stream_entries in new_entries:` line uses tuple unpacking, pulling the two elements of each returned pair directly into two named variables in one step, rather than indexing into the pair manually.

---

## 6. Streams vs Lists vs Pub/Sub

| | **Stream** | **List** | **Pub/Sub** |
|---|---|---|---|
| **Persistence** | Yes — entries remain until explicitly trimmed/deleted | Yes — entries remain until popped | No — fire-and-forget, no storage at all |
| **Multiple independent readers** | Yes, natively — via consumer groups or independent `XREAD` positions | No — a single `LPOP`/`RPOP` removes the entry for everyone | Yes, but only "live" subscribers; offline subscribers miss messages entirely |
| **Delivery guarantee / acknowledgment** | Yes — `XACK` and pending-entries tracking via consumer groups | None built-in | None — at-most-once, no acknowledgment concept |
| **Replay history** | Yes — `XRANGE` reads any historical range | Limited — once popped, it's gone | No — no history at all |
| **Typical use case** | Event logs, durable task queues, multi-consumer pipelines | Simple queues/stacks with a single consumer, capped recent-activity lists | Live, ephemeral notifications nobody needs guaranteed |

---

**Common mistakes:**
- Using a plain List for a workload with multiple consumers instead of a Stream — Lists have no concept of consumer groups or acknowledgment, so multiple consumers popping from the same List would race and effectively steal entries from each other rather than coordinating.
- Forgetting to `XACK` processed entries in a consumer-group workflow — unacknowledged entries stay in the pending entries list indefinitely, making it look like work is stuck even though it was actually completed.

**Interview angle:** A frequent framing is "how would you build a durable, multi-consumer event pipeline in Redis, and why not just use a List or Pub/Sub?" The answer worth giving names Streams specifically, explains that consumer groups guarantee each entry goes to exactly one consumer within a group (unlike a List, where concurrent consumers can race), and that `XACK`/pending-entries tracking gives you a delivery guarantee neither a List nor Pub/Sub provides on their own.

---

## 7. Hands-On Exercises

### Exercise 1 — Append and replay a small event log

Using `redis-cli`, `XADD` five entries to a stream representing some sequence of events (e.g. order status changes). Use `XRANGE key - +` to read them all back, then use `XRANGE` with two specific IDs (copied from the earlier output) to read just a sub-range.

### Exercise 2 — Simulate two independent consumers in a group

Create a consumer group with `XGROUP CREATE ... MKSTREAM`. Add several entries, then have two differently-named consumers each call `XREADGROUP` in turn — observe that each entry goes to only one of the two consumers, never both. Use `XACK` on the entries one consumer receives, then use `XPENDING` to confirm only the other consumer's entries remain unacknowledged.

### Exercise 3 — Compare a List-based queue to a Stream-based one

Build a tiny queue using `RPUSH`/`LPOP` with two "workers" (two separate `redis-cli` sessions or a small script) both popping at once — notice how a given entry only ever goes to whichever worker happens to pop first, with no group-level coordination. Then repeat the same scenario with a Stream and consumer group, and write a sentence comparing what changed.

---

## 8. Interview Q&A

### Q1. What problem do Redis Streams solve that Lists and Pub/Sub don't?

**Answer:** Streams provide a durable, ordered, append-only log that multiple independent consumers can read at their own pace, with the ability to replay history. Lists lack any concept of multiple coordinated readers, and Pub/Sub has zero persistence — an offline subscriber simply misses messages forever.

### Q2. What does the ID returned by `XADD` look like, and what does it guarantee?

**Answer:** By default (passing `*` as the ID), Redis generates an ID of the form `<milliseconds-since-epoch>-<sequence-number>`, where the sequence number disambiguates multiple entries added within the same millisecond. IDs are strictly increasing, which guarantees a stable, chronological ordering of entries.

### Q3. How do consumer groups prevent two consumers from processing the same entry twice?

**Answer:** When a consumer calls `XREADGROUP` with the special ID `>`, Redis only hands out entries that haven't yet been delivered to any consumer in that group, and tracks which consumer received which entry in a pending entries list. This guarantees each entry goes to exactly one consumer within the group, unlike a plain List where multiple poppers can race.

### Q4. What does `XACK` do, and what happens if you forget to call it?

**Answer:** `XACK` marks a delivered entry as successfully processed, removing it from the consumer group's pending entries list. If you forget to call it, the entry stays in the pending list indefinitely — visible via `XPENDING` — which typically indicates a consumer crashed or stalled mid-processing without acknowledging its work.

### Q5. Why would a List be the wrong choice for a multi-consumer task queue?

**Answer:** A List has no built-in concept of consumer groups, delivery tracking, or acknowledgment — `LPOP` simply removes and returns the item to whichever client called it first, so concurrent consumers effectively compete and can end up processing overlapping or inconsistent sets of items with no guarantee of exactly-once delivery per consumer.

---

> 🧠 **Memory hook:** "A Stream is a shared logbook — every entry timestamped and permanent, every reader keeping their own bookmark, nobody's page torn out from under them."
