# Redis in Practice

So far, Redis has shown up as a simple key-value store: `GET`/`SET` a serialized user object with a TTL. That's real and common, but it undersells what Redis actually is — an in-memory data structure server, not just a cache. The same single Redis instance sitting in your architecture diagram can also be your rate limiter, your session store, your leaderboard, and your pub/sub broker. Nearly every case study later in this course (Phases 10-11) leans on at least one of these beyond-basic-caching uses, so it's worth seeing them now.

```
                         ┌────────────────────────────┐
                         │           Redis            │
   Cache reads   ───────▶│  key → value (TTL)         │
                         │                            │
   Rate limiting ───────▶│  INCR counter (TTL window) │
                         │                            │
   Sessions      ───────▶│  session_id → user data    │
                         │                            │
   Leaderboards  ───────▶│  Sorted Set (score, member)│
                         │                            │
   Pub/Sub       ───────▶│  PUBLISH / SUBSCRIBE       │
                         └────────────────────────────┘
```

## Rate Limiting

A common interview follow-up after caching: "How would you stop one user from hitting `/login` 1000 times a second?" Redis's atomic `INCR` makes a simple fixed-window rate limiter almost trivial:

```python
def is_allowed(user_id: int, limit: int = 10, window_seconds: int = 60) -> bool:
    key = f"ratelimit:{user_id}"
    count = r.incr(key)          # atomic increment, creates key at 0 if missing
    if count == 1:
        r.expire(key, window_seconds)   # start the window on the first request
    return count <= limit
```

Every request for a user increments the same counter; the first request in a window sets it to expire after `window_seconds`, so the counter naturally resets. If `count` exceeds `limit` before the window expires, the request is rejected (typically with a `429 Too Many Requests`).

## Session Storage

Phase 03 explained why a stateless backend can't rely on server-local memory for session data — if the next request lands on a different server behind the load balancer, that server has no idea who you are. Redis solves this by acting as a **shared** session store every backend instance can reach:

```python
def create_session(session_id: str, user_id: int):
    r.set(f"session:{session_id}", user_id, ex=3600)   # 1 hour session

def get_session_user(session_id: str):
    return r.get(f"session:{session_id}")
```

Any server behind the load balancer can look up `session:<id>` and get the same answer, because the session lives in Redis, not in any one server's process memory. (Phase 08 covers the more common modern alternative — JWTs, which skip the shared store entirely by putting the session data in the token itself.)

## Leaderboards (Sorted Sets)

Redis's **sorted set** data structure keeps members ordered by a numeric score automatically, which makes it a near-perfect fit for leaderboards, trending lists, or "top N" queries that would otherwise require an expensive `ORDER BY ... LIMIT` query against a database on every request:

```python
r.zadd("game:leaderboard", {"player:42": 1500, "player:7": 2100})
r.zincrby("game:leaderboard", 50, "player:42")     # player:42's score is now 1550

top_3 = r.zrevrange("game:leaderboard", 0, 2, withscores=True)
# [('player:7', 2100.0), ('player:42', 1550.0), ...]
```

Inserts, score updates, and "give me the top N" reads are all `O(log N)` — fast enough to update on every single game point scored, across millions of players, without touching a database.

## Pub/Sub

Redis also supports **publish/subscribe**: a publisher sends a message to a named channel, and every currently-subscribed client receives it immediately, with no persistence and no queue of unread messages.

```python
# Publisher (e.g. a notification service)
r.publish("chat:room:42", "New message from Asha")

# Subscriber (e.g. a WebSocket-connected client's backend)
pubsub = r.pubsub()
pubsub.subscribe("chat:room:42")
for message in pubsub.listen():
    print(message["data"])   # b'New message from Asha'
```

This is a lightweight way to fan a real-time event out to multiple live listeners (think: everyone currently viewing a chat room). It's deliberately simple — if a subscriber is offline when a message is published, it simply never sees it. Phase 07 covers task queues and more durable event-driven patterns (Kafka, RabbitMQ) for cases where messages *must* survive a subscriber being temporarily down.

## Interview Q&A

**Q: Beyond caching, what else is Redis commonly used for in a production backend?**
Answer: Rate limiting (atomic counters with `INCR`/`EXPIRE`), shared session storage across stateless servers, leaderboards and ranking via sorted sets, and lightweight real-time pub/sub for fan-out to live listeners. It's useful in all these cases because it's an in-memory data structure server with atomic operations, not just a key-value cache.

**Q: How would you implement a simple rate limiter using Redis?**
Answer: Use `INCR` on a per-user, per-time-window key (e.g. `ratelimit:user:42`) to atomically count requests, and set that key to expire after the window duration on the first increment. If the count exceeds the allowed limit before the key expires, reject the request. `INCR` being atomic is what prevents a race condition where two concurrent requests both read the count as "under the limit" and both get allowed through.

**Q: Why is Redis a good fit for leaderboards compared to querying a relational database for "top N"?**
Answer: Redis's sorted set keeps all members ordered by score automatically as an in-memory structure, so both updating a score and reading the top N are O(log N) operations with no query planning or disk I/O. A relational database would need an `ORDER BY score DESC LIMIT N` query, which is far slower under high write volume (score updates on every point scored) and doesn't scale to being called on every page load for millions of concurrent users.

**Q: What's the key limitation of Redis pub/sub compared to a real message queue?**
Answer: Redis pub/sub has no persistence or delivery guarantee — if a subscriber isn't actively connected when a message is published, that message is lost forever, and there's no retry or replay. A real message queue (RabbitMQ) or log-based system (Kafka), covered in Phase 07, persists messages so consumers that are offline or slow can still process them later.

**Q: If two backend servers behind a load balancer both need to know whether a user is logged in, how does Redis-backed session storage solve that?**
Answer: Instead of each server keeping session state in its own local memory (which breaks the moment a user's requests land on a different server), both servers read and write session data to the same shared Redis instance keyed by session ID. Any server can look up `session:<id>` and get an identical answer, which is exactly the externalized-state fix Phase 03 introduced as a requirement for horizontal scaling.
