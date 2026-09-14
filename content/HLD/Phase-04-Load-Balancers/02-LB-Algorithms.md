# Load Balancer Algorithms

Lesson 01 established *that* a load balancer spreads traffic across servers. This lesson covers *how* it decides which server gets each request — the choice of algorithm matters, because the wrong one can leave some servers idle while others are overloaded, or break features that depend on a user hitting the same server twice.

## Round Robin

The simplest strategy: cycle through the server list in order, one request each.

```
Request 1 ──▶ API-1
Request 2 ──▶ API-2
Request 3 ──▶ API-3
Request 4 ──▶ API-1   (cycle repeats)
Request 5 ──▶ API-2
```

Round robin assumes every server and every request is roughly equal in cost. It's the default in most load balancers because it's simple and fair *when that assumption holds*.

## Weighted Round Robin

If your servers aren't identical — say API-1 runs on a bigger instance than API-2 and API-3 — plain round robin under-uses API-1 and over-loads the smaller boxes. Weighted round robin assigns each server a weight and sends it a proportional share of requests.

```
Weights:  API-1 = 3,  API-2 = 1,  API-3 = 1   (API-1 is a 3x bigger box)

Request 1 ──▶ API-1
Request 2 ──▶ API-1
Request 3 ──▶ API-1
Request 4 ──▶ API-2
Request 5 ──▶ API-3
Request 6 ──▶ API-1   (cycle repeats: 3 to API-1, 1 to API-2, 1 to API-3)
```

## Least Connections

Round robin (weighted or not) distributes requests *evenly by count*, but requests aren't all equally cheap — some finish in 5ms, others hold a connection open for 30 seconds (a slow report generation, a long-lived websocket). Least connections routes each new request to whichever server currently has the fewest active connections, which adapts to real load rather than assuming every request is the same size.

```
                Active connections right now:
                API-1: 12    API-2: 3    API-3: 8

New request ──────────────────────────▶ API-2   (fewest active connections)
```

This is generally the better default for workloads with variable request duration, at the cost of the load balancer needing to track connection counts per server (slightly more state than round robin's simple counter).

## Consistent Hashing (and Why You'd Want Sticky Sessions)

All three algorithms above assume it doesn't matter which server handles a given user's request — any healthy server is as good as any other. That assumption breaks the moment a server holds something *local* that's specific to a user: an in-memory cache of their recently viewed items, a WebSocket connection, a partially uploaded file being buffered on disk.

If User A's first request goes to API-1 (which builds up an in-memory cache for them) and their second request round-robins to API-2, API-2 has none of that cached state — it's a cache miss every time, or worse, the feature breaks outright (a WebSocket connection can't just "continue" on a different server).

The fix is **sticky sessions**: routing the *same* user consistently to the *same* server. Consistent hashing is the standard way to implement this:

```
Hash ring (simplified):

         API-1
        ╱      ╲
   API-3        API-2
        ╲      ╱
      hash(user_id) lands here → routed to nearest server (API-2)
```

The load balancer hashes something stable about the request — usually the user ID, session ID, or client IP — and uses that hash to consistently pick the same server for that same key, every time. "Consistent" specifically refers to the property that when a server is added or removed, only the keys that were mapped to *that* server need to be remapped — everyone else's mapping stays the same (compare this to naive `hash(key) % N`, where changing `N` by adding/removing one server reshuffles almost *everyone's* assignment).

This is the same technique used later for cache-server assignment (Phase 06) and database sharding (Phase 05, Lesson 03) — "which one of N nodes owns this key" is a recurring problem in distributed systems, and consistent hashing is the general-purpose answer.

## Quick Comparison

| Algorithm | Good for | Weak point |
|---|---|---|
| Round robin | Uniform servers, uniform request cost | Ignores real load differences |
| Weighted round robin | Non-uniform server capacity | Still ignores per-request cost |
| Least connections | Variable request duration | Needs live connection tracking |
| Consistent hashing | Sticky sessions, per-server local cache/state | Uneven load if key distribution is skewed |

## Interview Q&A

**Q: How would you route requests so the same user always hits the same server, and why would you want that?**
Answer: Use consistent hashing on a stable key like the user ID, session ID, or client IP — the load balancer hashes that key onto a hash ring and always routes it to the same server as long as that server is up. You'd want this ("sticky sessions") whenever a server holds something locally that's specific to that user: an in-memory cache warmed up for them, an open WebSocket connection, or an in-progress multi-step upload. Without stickiness, each request could land on a different server that has none of that local state, causing cache misses or breaking stateful features outright.

**Q: What's the difference between round robin and least connections, and when would you prefer one over the other?**
Answer: Round robin cycles through servers by count, assuming every request costs about the same to serve. Least connections instead routes each new request to the server with the fewest currently-active connections, adapting to real-time load. Least connections is the better choice when request duration varies a lot (some fast, some slow/long-lived); round robin is fine — and simpler — when requests are roughly uniform in cost.

**Q: Why is consistent hashing preferred over a plain `hash(key) % N` scheme when the number of servers changes?**
Answer: With plain modulo hashing, changing `N` (adding or removing even one server) changes the result of `hash(key) % N` for the vast majority of keys, forcing almost everything to be remapped/rebalanced at once. Consistent hashing arranges servers and keys on a hash ring so that adding or removing a server only affects the keys immediately adjacent to that server on the ring — everyone else keeps their existing mapping. This matters a lot for caches (Phase 06) and sharded databases (Phase 05), where a full remap on every scaling event would be extremely disruptive.

**Q: What's a downside of sticky sessions / consistent hashing compared to plain round robin?**
Answer: If the key distribution is skewed — say a small number of very active users or a "hot" shard — the servers that happen to own those keys get disproportionately more load than servers that don't, even though the total number of unique keys is balanced. Plain round robin doesn't have this problem because it ignores keys entirely and just cycles evenly. In practice this is mitigated with techniques like virtual nodes (mapping each physical server to many points on the hash ring to smooth out imbalance).

**Q: Why do health checks matter more for some of these algorithms than others?**
Answer: All of them need health checks to avoid routing to a dead server, but the impact of a missed health check is worse under consistent hashing/sticky sessions: with round robin, a user's next request eventually lands on a different, healthy server anyway. With sticky sessions, that specific user keeps being routed back to the same (now-dead) server until the health check catches up and the ring is rebalanced, so the outage is concentrated on that user rather than spread thin — which is a trade-off worth calling out explicitly in an interview.
