# 01 — Pub/Sub Basics

> A comprehensive reference covering Redis Pub/Sub — `PUBLISH`/`SUBSCRIBE`/`PSUBSCRIBE`, the at-most-once delivery model, and why it's the right tool for live events but the wrong tool for anything that must never be lost.

---

## Table of Contents

1. [The Problem: Reacting to Events the Instant They Happen](#1-the-problem-reacting-to-events-the-instant-they-happen)
2. [The Analogy: A Radio Broadcast](#2-the-analogy-a-radio-broadcast)
3. [Internal Flow: PUBLISH, SUBSCRIBE, and PSUBSCRIBE](#3-internal-flow-publish-subscribe-and-psubscribe)
4. [Code Example: Two Terminals and redis-py](#4-code-example-two-terminals-and-redis-py)
5. [Pub/Sub's Delivery Model, Common Mistakes, and the Interview Angle](#5-pubsubs-delivery-model-common-mistakes-and-the-interview-angle)
6. [Hands-On Exercises](#6-hands-on-exercises)
7. [Interview Q&A](#7-interview-qa)

---

## 1. The Problem: Reacting to Events the Instant They Happen

Some parts of a system don't want to *ask* whether something changed — they want to be *told*, the moment it does. A chat app needs every open browser tab in a room to see a new message within milliseconds. A live dashboard needs to update the instant a metric changes. A notification bell needs to light up the second an event fires, for every connected client that cares about it.

The naive approach is polling: have every client repeatedly ask a database "anything new?" every second. That works, but it scales badly — a thousand clients polling once a second is a thousand queries a second, almost all of which come back with nothing new, just to catch the rare moment something *did* change. What's actually needed is a way to push an event out to everyone interested, the instant it happens, without them having to keep asking. That's exactly the gap Redis Pub/Sub fills.

---

## 2. The Analogy: A Radio Broadcast

**Real-world analogy:** think of a radio station. The station (the **publisher**) transmits on a specific frequency. Anyone with a radio tuned to that frequency (a **subscriber**) hears the broadcast live, the instant it airs. The station doesn't know or care who's listening, and it doesn't keep a recording for someone who tunes in late — if your radio was off, or tuned to a different station, you simply missed it. There's no rewind.

Redis Pub/Sub works exactly like that. A **channel** is the frequency. `PUBLISH` is the station transmitting. `SUBSCRIBE` is tuning in. And critically — just like the radio — **there's no replay**. A subscriber that wasn't connected and listening at the moment a message was published never sees it. Nothing is stored anywhere for later.

---

## 3. Internal Flow: PUBLISH, SUBSCRIBE, and PSUBSCRIBE

Redis Pub/Sub has three core commands:

- **`SUBSCRIBE channel [channel ...]`** — a client tells Redis it wants to receive every message published to one or more exact channel names. The moment this command runs, that connection enters **subscribe mode**.
- **`PUBLISH channel message`** — sends `message` to every client currently subscribed to `channel`. It returns an integer: the number of subscribers that received it (`0` if nobody was listening — the message is simply discarded, not queued for later).
- **`PSUBSCRIBE pattern [pattern ...]`** — like `SUBSCRIBE`, but matches channel names against a glob-style pattern instead of an exact name. For example, `PSUBSCRIBE news.*` receives everything published to `news.sports`, `news.weather`, or any other channel starting with `news.`, without needing to know every exact channel name in advance.

A subtlety that trips people up the first time: once a connection calls `SUBSCRIBE` (or `PSUBSCRIBE`), that connection is now dedicated to receiving messages. In the classic (RESP2) Pub/Sub model, that same connection can no longer run ordinary commands like `GET` or `SET` — it can only manage its subscriptions (`SUBSCRIBE`, `UNSUBSCRIBE`, `PSUBSCRIBE`, `PUNSUBSCRIBE`) or `PING`/`QUIT`. In practice this means a real application keeps a separate connection just for subscribing, distinct from the connection(s) it uses to run normal commands.

There is **no persistence anywhere in this flow**. Redis does not write published messages to disk, does not queue them for offline subscribers, and does not remember they ever happened once delivered. It is a pure at-most-once, fire-and-forget broadcast.

---

## 4. Code Example: Two Terminals and redis-py

**Terminal A — the subscriber**, using `redis-cli`:

```bash
redis-cli SUBSCRIBE notifications
```

Redis immediately confirms the subscription:

```
1) "subscribe"
2) "notifications"
3) (integer) 1
```

That third line — `(integer) 1`— is the total number of channels this connection is now subscribed to (just one, so far). The terminal now blocks, waiting.

**Terminal B — the publisher**, in a separate `redis-cli` session:

```bash
redis-cli PUBLISH notifications "new message"
```

```
(integer) 1
```

The `1` here means exactly one subscriber received the message. Back in **Terminal A**, the moment `PUBLISH` runs, this appears automatically:

```
1) "message"
2) "notifications"
3) "new message"
```

No polling happened — Terminal A received this the instant Terminal B published it.

**The same thing from `redis-py`**, using the client's `pubsub()` helper:

```python
import redis

r = redis.Redis(host="localhost", port=6379, decode_responses=True)
p = r.pubsub()
p.subscribe("notifications")

for message in p.listen():
    print(message)
```

`p.listen()` is a generator — a Python construct that yields one value at a time, pausing in between, instead of building a whole list upfront. The first item it yields is always the subscription confirmation itself:

```python
{'type': 'subscribe', 'pattern': None, 'channel': 'notifications', 'data': 1}
```

Then, once something is published to `notifications` from anywhere (another `redis-py` client, or plain `redis-cli PUBLISH`), the loop yields:

```python
{'type': 'message', 'pattern': None, 'channel': 'notifications', 'data': 'new message'}
```

The loop runs forever, blocking on each iteration until the next message arrives — this is the Python side of the same blocking "subscribe mode" behavior seen in `redis-cli`.

---

## 5. Pub/Sub's Delivery Model, Common Mistakes, and the Interview Angle

| | **Redis Pub/Sub** |
|---|---|
| **Delivery guarantee** | At-most-once — delivered only to clients subscribed *at the moment of publish* |
| **Persistence** | None — a message that's published and received (or missed) is gone forever |
| **Offline subscribers** | Miss every message published while disconnected, with no way to catch up |
| **Acknowledgment** | None — the publisher has no idea if a subscriber actually processed the message, only that it was handed to the connection |
| **Ordering** | Messages to a single channel are delivered in the order they were published |
| **Typical use case** | Live notifications, chat relay, real-time dashboards — anything where losing a message occasionally is acceptable |

**Common mistakes:**
- Assuming a subscriber that was offline, or connecting late, will somehow receive messages published before it subscribed — Pub/Sub has zero persistence or history; this is exactly the gap Streams close, covered next.
- Using the same Redis connection for both subscribing and running regular application commands, then being confused when that connection appears to "hang" — a connection in subscribe mode is dedicated to receiving messages.
- Treating a `PUBLISH` return value of `0` as an error — it isn't one. It's a completely normal, valid outcome meaning "nobody happened to be listening," and the message is simply discarded.

**Interview angle:** a classic question is "when would you *not* use Redis Pub/Sub?" The expected answer is: anytime the message must not be lost if a consumer is briefly offline, anytime you need to know a message was actually processed (not just delivered to a socket), or anytime multiple independent consumers need to divide up work without duplicating it. Pub/Sub gives you none of that — it's built for low-latency broadcast, not guaranteed delivery, which is exactly why Redis Streams (with consumer groups) exist as a separate, durable mechanism for those requirements.

---

## 6. Hands-On Exercises

### Exercise 1 — Two-terminal live broadcast

Open two `redis-cli` sessions. In one, run `SUBSCRIBE room:general`. In the other, run `PUBLISH room:general "hello"` a few times, with a short pause between each. Confirm each message appears instantly in the subscriber terminal, and note what the subscriber terminal shows if you *close and reopen* it between two `PUBLISH` calls — did it receive the one published while it was closed?

### Exercise 2 — Pattern subscriptions with PSUBSCRIBE

In one terminal, run `PSUBSCRIBE news.*`. In another, publish to a few different channels: `PUBLISH news.sports "score update"`, `PUBLISH news.weather "storm warning"`, and `PUBLISH sports.news "wrong prefix"`. Confirm which publishes the pattern subscriber receives and which it doesn't, and explain why in one sentence.

### Exercise 3 — redis-py listener with a message counter

Write a small Python script using `redis-py`'s `pubsub()` and `listen()` that subscribes to a channel and prints a running count of messages received so far, alongside each message's content. Run it, then publish several messages from a separate `redis-cli` session and confirm the count increments correctly.

---

## 7. Interview Q&A

### Q1. What delivery guarantee does Redis Pub/Sub provide?

**Answer:** At-most-once delivery, and only to clients that are actively subscribed at the exact moment a message is published. There is no persistence, no message history, and no way for a client to "catch up" on messages published while it was disconnected.

---

### Q2. What does `PUBLISH` return, and what does that value mean?

**Answer:** `PUBLISH` returns an integer — the number of subscribers that received the message. A return value of `0` is completely normal and simply means no client was subscribed to that channel at that moment; it is not an error.

---

### Q3. What's the difference between `SUBSCRIBE` and `PSUBSCRIBE`?

**Answer:** `SUBSCRIBE` matches one or more exact channel names. `PSUBSCRIBE` matches channel names against a glob-style pattern (e.g. `news.*`), so a client can receive messages from any channel matching that pattern without knowing every exact channel name up front.

---

### Q4. Why can't a client run normal commands like `GET` on a connection that just called `SUBSCRIBE`?

**Answer:** Calling `SUBSCRIBE` (or `PSUBSCRIBE`) puts that connection into a dedicated subscribe mode. In the classic Pub/Sub model, that connection can only manage its subscriptions or `PING`/`QUIT` until it unsubscribes — which is why real applications use a separate connection for subscribing versus running ordinary commands.

---

### Q5. When should you avoid Redis Pub/Sub and reach for Streams instead?

**Answer:** Whenever losing a message for an offline or slow consumer is unacceptable, whenever you need confirmation that a message was actually processed (not just delivered), or whenever multiple consumers need to divide up work without duplicating it. Pub/Sub provides none of these guarantees; Redis Streams with consumer groups are built specifically to provide them.

---

> 🧠 **Memory hook:** "Pub/Sub is a live radio broadcast — tune in and you hear it, tune in late and it's simply gone."
