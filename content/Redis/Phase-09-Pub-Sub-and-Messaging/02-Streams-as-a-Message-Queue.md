# 02 — Streams as a Message Queue

> A comprehensive reference covering Redis Streams with consumer groups — `XGROUP CREATE`, `XREADGROUP`, `XACK`, and `XPENDING` — as a durable, delivery-guaranteed alternative to Pub/Sub for real work queues.

---

## Table of Contents

1. [The Problem: Pub/Sub Isn't Enough for a Real Queue](#1-the-problem-pubsub-isnt-enough-for-a-real-queue)
2. [The Analogy: A Help Desk Ticket Queue](#2-the-analogy-a-help-desk-ticket-queue)
3. [Internal Flow: Consumer Groups on Top of Streams](#3-internal-flow-consumer-groups-on-top-of-streams)
4. [Code Example: Two Consumers, One Stream, No Duplicates](#4-code-example-two-consumers-one-stream-no-duplicates)
5. [Pub/Sub vs Streams with Consumer Groups](#5-pubsub-vs-streams-with-consumer-groups)
6. [Common Mistakes and the Interview Angle](#6-common-mistakes-and-the-interview-angle)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. The Problem: Pub/Sub Isn't Enough for a Real Queue

Pub/Sub (previous lesson) is great for events nobody is truly relying on — a live notification badge that would be nice to update instantly, but where missing one occasionally is a non-event. A real message queue — order processing, sending emails, running background jobs — has completely different requirements:

- **Don't lose work.** If a consumer was briefly down when a task was "published," that task must still be waiting for it when it comes back — not gone forever.
- **Don't double-process work.** If two worker processes are both pulling from the same queue, a given task should go to exactly one of them, not both racing to grab it.
- **Know what's still outstanding.** If a worker crashes mid-task, something needs to be able to see "this task was handed out but never confirmed done" and re-deliver it.

Plain Pub/Sub has none of these properties — it doesn't even try to. This is exactly the gap **Redis Streams**, combined with **consumer groups**, are built to close.

---

## 2. The Analogy: A Help Desk Ticket Queue

**Real-world analogy:** Pub/Sub is a live radio broadcast — miss it, and it's gone. A Stream with a consumer group is a completely different kind of system: a **shared ticket queue at a help desk**. Tickets pile up in order. Any available staff member can pull the next unclaimed ticket off the pile — but once a specific staff member has taken a ticket, it's *theirs*; nobody else grabs it too. If that staff member steps away without marking the ticket "resolved," a supervisor can look at the board and see exactly which tickets are still sitting there, unresolved, in someone's hands.

That's the whole model: `XADD` puts a new ticket on the pile. A **consumer group** is the shared pile itself, tracked by Redis. Each named **consumer** within the group claims tickets without ever claiming the same one another consumer already has. `XACK` is marking a ticket "resolved." `XPENDING` is the supervisor's view of everything claimed-but-not-yet-resolved.

---

## 3. Internal Flow: Consumer Groups on Top of Streams

Phase 4 introduced the Stream fundamentals — `XADD` to append an entry with an auto-generated ID, and `XRANGE`/`XREAD` to read entries directly. Consumer groups build a coordination layer on top of that same underlying Stream:

- **`XGROUP CREATE stream group start-id [MKSTREAM]`** — creates a named consumer group (`group`) on a given `stream`. `start-id` tells Redis where in the stream's history this group should start reading from: `$` means "only entries added *after* this group is created," while `0` means "start from the very beginning of the stream." `MKSTREAM` creates the stream itself if it doesn't already exist yet, so `XGROUP CREATE` can be the very first command run against a brand-new stream.
- **`XREADGROUP GROUP group consumer COUNT n STREAMS stream >`** — a specific named `consumer` inside `group` asks for up to `n` entries it hasn't been given yet. The special ID `>` means "give me only entries never yet delivered to *any* consumer in this group." Once Redis hands an entry to a consumer this way, that entry is recorded as **pending** for that consumer — no other consumer in the same group will receive it, even if they also call `XREADGROUP` with `>`.
- **`XACK stream group id [id ...]`** — marks the given entry ID(s) as successfully processed for that group, removing them from the group's pending list.
- **`XPENDING stream group`** — without further arguments, returns a summary: how many entries are pending, the lowest and highest pending IDs, and a breakdown of how many are pending per consumer. This is exactly the "supervisor's view" of tickets claimed but not yet resolved — useful for spotting a consumer that crashed mid-task and never called `XACK`.

The key guarantee this gives you that Pub/Sub never could: an entry delivered via `XREADGROUP` stays recorded in the stream and in that group's pending list until explicitly `XACK`'d. A consumer that crashes before acknowledging doesn't lose the work — it just sits visibly in `XPENDING` until something (a monitoring process, or the consumer itself on restart) deals with it.

---

## 4. Code Example: Two Consumers, One Stream, No Duplicates

Create a consumer group named `workers` on a brand-new stream called `tasks`, using `MKSTREAM` since `tasks` doesn't exist yet:

```bash
redis-cli XGROUP CREATE tasks workers $ MKSTREAM
```

```
OK
```

Now add two task entries to the stream — this is the same `XADD` from Phase 4, `*` telling Redis to auto-generate the ID:

```bash
redis-cli XADD tasks '*' job "send_email" to "alice@example.com"
redis-cli XADD tasks '*' job "resize_image" file "banner.png"
```

```
"1700000000000-0"
"1700000000010-0"
```

**Consumer 1** asks for one new entry from the `workers` group:

```bash
redis-cli XREADGROUP GROUP workers consumer-1 COUNT 1 STREAMS tasks '>'
```

```
1) 1) "tasks"
   2) 1) 1) "1700000000000-0"
         2) 1) "job"
            2) "send_email"
            3) "to"
            4) "alice@example.com"
```

Consumer 1 got the `send_email` entry. **Consumer 2**, in the *same* group, also asks for one new entry:

```bash
redis-cli XREADGROUP GROUP workers consumer-2 COUNT 1 STREAMS tasks '>'
```

```
1) 1) "tasks"
   2) 1) 1) "1700000000010-0"
         2) 1) "job"
            2) "resize_image"
            3) "file"
            4) "banner.png"
```

Consumer 2 got the *other* entry, `resize_image` — not a duplicate of consumer 1's entry, because the `workers` group tracks that `1700000000000-0` was already delivered to someone. This is the "no two staff members grab the same ticket" guarantee in action.

Consumer 1 finishes its task and acknowledges it:

```bash
redis-cli XACK tasks workers 1700000000000-0
```

```
(integer) 1
```

The `1` confirms one pending entry was acknowledged and removed from the group's pending list. Checking what's still outstanding:

```bash
redis-cli XPENDING tasks workers
```

```
1) (integer) 1
2) "1700000000010-0"
3) "1700000000010-0"
4) 1) 1) "consumer-2"
      2) "1"
```

This shows exactly one entry still pending — `1700000000010-0`, sitting with `consumer-2`, who hasn't called `XACK` yet. If `consumer-2` crashed right now, this is precisely how a monitoring process would know that entry needs to be re-delivered to someone else.

---

## 5. Pub/Sub vs Streams with Consumer Groups

| | **Pub/Sub** | **Streams + Consumer Groups** |
|---|---|---|
| **Persistence** | None — nothing is stored | Entries persist in the stream until explicitly trimmed |
| **Delivery guarantee** | At-most-once, only to currently-connected subscribers | At-least-once — an unacknowledged entry stays pending and can be re-delivered |
| **Replay capability** | None — offline clients miss messages permanently | Yes — `XRANGE`/`XREAD` can replay any entry still in the stream |
| **Work distribution** | Every subscriber gets every message (broadcast) | Each entry goes to exactly one consumer per group (competing consumers) |
| **Visibility into in-flight work** | None | `XPENDING` shows exactly what's claimed but unacknowledged |
| **Typical use case** | Live notifications, chat relay, real-time UI updates | Task queues, order processing, anything needing guaranteed processing |

---

## 6. Common Mistakes and the Interview Angle

**Common mistakes:**
- Choosing Pub/Sub for a workload that actually needs guaranteed delivery — an offline or crashed consumer simply loses those messages forever, since Pub/Sub has no memory of what it sent.
- Forgetting to call `XACK` after successfully processing an entry, leaving it permanently stuck in the pending entries list — over time this list grows unbounded and obscures which entries are *genuinely* stuck versus just recently delivered.
- Creating the consumer group with `MKSTREAM` and `$` on a stream that *already* has entries you wanted processed — `$` means "only future entries," so anything added before the group existed is silently skipped by that group; use `0` as the start ID if the group should process the stream's existing history too.

**Interview angle:** a frequent system-design-adjacent question is "how would you build a reliable task queue with Redis, and why not just use Pub/Sub?" The strong answer names the exact three guarantees Pub/Sub lacks — persistence, at-least-once delivery, and competing-consumer semantics — and explains that Streams with consumer groups provide all three: `XADD` durably appends work, `XREADGROUP` with `>` ensures each entry goes to only one consumer in the group, and `XPENDING`/re-delivery handles a consumer that dies mid-task. Being able to name `XACK` specifically as the mechanism that closes the loop is usually what separates a surface-level answer from one that shows real hands-on familiarity.

---

## 7. Hands-On Exercises

### Exercise 1 — Build the two-consumer flow yourself

Recreate the `tasks`/`workers` example above end to end using `redis-cli`: create the group with `MKSTREAM`, add three entries, then have two differently-named consumers each call `XREADGROUP` with `COUNT 1` twice in a row. Confirm all three entries were distributed without any consumer receiving the same entry twice.

### Exercise 2 — Simulate a crashed consumer

Using the same setup, have a consumer call `XREADGROUP` to claim an entry but *never* call `XACK` on it. Run `XPENDING tasks workers` and confirm that entry shows up as pending under that consumer's name. This is the exact signal a real monitoring process would use to detect stuck work.

### Exercise 3 — Group creation start-id behavior

Create a stream and add two entries to it *before* creating a consumer group. Create the group once with start ID `$` and once (on a differently-named group) with start ID `0`. Have a consumer in each group call `XREADGROUP` with `>` and compare what each group receives — confirm the `$` group gets nothing from the pre-existing entries while the `0` group gets both.

---

## 8. Interview Q&A

### Q1. What does a Redis Stream consumer group provide that Pub/Sub doesn't?

**Answer:** Persistence of entries, at-least-once delivery guarantees (an unacknowledged entry stays pending and can be re-delivered), and competing-consumer semantics where each entry is delivered to exactly one consumer within the group rather than broadcast to everyone.

---

### Q2. What does the special ID `>` mean in `XREADGROUP`?

**Answer:** It tells Redis to deliver only entries that have never been delivered to any consumer in that group before. Once an entry is handed to a consumer via `>`, it's recorded as pending for that consumer, so no other consumer in the same group receives it again through `>`.

---

### Q3. What's the difference between start ID `$` and `0` when running `XGROUP CREATE`?

**Answer:** `$` means the group only sees entries added to the stream after the group is created — any existing entries are skipped for that group. `0` means the group starts from the very beginning of the stream's history, so it will also receive entries that were already in the stream before the group existed.

---

### Q4. What happens if a consumer reads an entry via `XREADGROUP` but never calls `XACK`?

**Answer:** The entry stays in that group's pending entries list indefinitely, associated with the consumer that read it. It's visible via `XPENDING`, which is exactly how a monitoring process or another consumer can detect work that was claimed but never confirmed as processed — for example, because the original consumer crashed.

---

### Q5. Why would you choose Streams with consumer groups over Pub/Sub for a task queue?

**Answer:** Because a task queue needs guarantees Pub/Sub explicitly does not provide: durability (entries aren't lost if no consumer is currently connected), at-least-once delivery (a crashed consumer's unacknowledged entry can be re-delivered), and safe work distribution across multiple competing consumers without duplication.

---

> 🧠 **Memory hook:** "Pub/Sub broadcasts to everyone listening right now; a Stream consumer group hands out tickets — one per worker, nothing lost, nothing double-booked."
