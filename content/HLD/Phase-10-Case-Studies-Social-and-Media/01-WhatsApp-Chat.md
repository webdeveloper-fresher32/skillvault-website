# Design WhatsApp / A Chat Application

"Design WhatsApp" is really three problems wearing one trenchcoat: get a message from A to B fast, know whether B is online, and don't lose a message if B isn't. Everything below builds toward those three problems.

## 1. Requirements

**Functional requirements:**
- Users can send 1:1 text messages that are delivered to the recipient in near real time.
- A message shows delivery state: sent → delivered → read (the single, double, blue-tick progression).
- Users can see whether their contacts are "online," "last seen," or offline.
- Messages sent while the recipient is offline are delivered once they reconnect (not dropped).
- (Group chat and media messages exist in the real product but are explicitly out of scope for this lesson — the 1:1 text case already contains the hard problems.)

**Non-functional requirements:**
- **Availability over strict consistency** — a chat app must feel "always up." It is acceptable for a read receipt to arrive a few hundred milliseconds late; it is not acceptable for the app to reject a message send because a server is having a bad moment. This is an AP choice in Phase 09's CAP framing.
- **Latency target:** message delivery to an online recipient in well under 1 second, end to end.
- **Scale target:** design for 500 million DAU, each sending ~40 messages/day.
- **Durability:** a message accepted by the server must never be lost, even if the recipient is offline for days.

## 2. Back-of-envelope estimation

Using Phase 01 Lesson 03's method — start from DAU, derive load:

- DAU: 500,000,000
- Messages/user/day: 40
- Total messages/day: 500M × 40 = **20 billion messages/day**
- Messages/sec (average): 20,000,000,000 / 86,400 ≈ **231,000 messages/sec**
- Peak (assume 3-5x average for evening peak traffic): **~1 million messages/sec** at peak — this is the number that decides whether a single database or queue partition can survive, and the answer is no, which is exactly why the architecture below shards by user.
- Storage per message: ~100 bytes (sender, recipient, timestamp, text, message id) → 20B × 100 bytes/day ≈ **2 TB/day**, ~730 TB/year of message metadata alone (before media, which is out of scope here).
- Concurrent connections: if even 30% of DAU is online at any moment, that's 150 million simultaneous long-lived connections to hold open — this single number is why "one server holds a socket per user" doesn't work and connection routing has to be sharded across many gateway servers.

## 3. High-level architecture

```
                                 ┌─────────────────┐
                                 │   API Gateway    │  (Phase 08 L2 — auth, rate limit)
                                 └────────┬─────────┘
                                          │
                        ┌─────────────────┼─────────────────┐
                        ▼                 ▼                 ▼
              ┌──────────────┐  ┌──────────────┐   ┌──────────────┐
              │ Chat Gateway  │  │ Chat Gateway  │   │ Chat Gateway  │   (WebSocket servers,
              │  (WS server)  │  │  (WS server)  │   │  (WS server)  │    behind an L4 LB — Phase 04)
              └───────┬───────┘  └───────┬───────┘   └───────┬───────┘
                      │                  │                    │
                      └────────┬─────────┴─────────┬──────────┘
                                ▼                    ▼
                     ┌────────────────────┐  ┌────────────────────┐
                     │ Presence Store      │  │ Message Queue       │  (Phase 07 — per-user
                     │ (Redis: user→gateway)│  │ (Kafka/RabbitMQ)     │   delivery queue)
                     └────────────────────┘  └──────────┬─────────┘
                                                          ▼
                                              ┌────────────────────┐
                                              │ Message Store        │  (Cassandra/DynamoDB —
                                              │ (sharded by user id)  │   Phase 05 L3 sharding,
                                              └────────────────────┘   Phase 05 L4 NoSQL choice)
```

- **Chat Gateway (WebSocket servers)** hold the persistent connections. Because a user's socket can be on any gateway instance, we can't rely on in-memory state (Phase 03 Lesson 02 — statelessness) — so "which gateway is user X connected to" is looked up centrally.
- **Presence Store (Redis)** maps `user_id → gateway_instance_id` plus a `last_heartbeat` timestamp. This is Phase 06 Lesson 03's Redis-for-more-than-caching use case.
- **Message Queue** decouples "message accepted" from "message delivered" — the sender gets an immediate ack the moment the message is durably queued, per Phase 07 Lesson 01's async-processing pattern.
- **Message Store** is a NoSQL, sharded-by-user-id store (Phase 05 Lesson 04's SQL-vs-NoSQL call: message history is high write volume, doesn't need joins, and benefits from horizontal scale over strict relational structure).

## 4. Deep dive

### 4.1 Message delivery: queue-per-user + WebSockets

The core delivery flow when A sends a message to B:

```
A → Chat Gateway (A's socket) → append to Message Store (durability first)
                               → look up B's presence in Redis
                                    ├─ B online on Gateway-3  → push message directly over B's socket
                                    └─ B offline               → leave it in B's per-user delivery queue
```

1. **Write-then-notify, not notify-then-write.** The message is persisted to the Message Store *before* any delivery attempt. If delivery fails for any reason, the message still exists and can be redelivered — this is the durability requirement from Section 1.
2. **Per-user delivery queue.** Each user has a logical queue of undelivered messages (in practice: a partition in Kafka keyed by `recipient_id`, or a per-user list in the message store marked "undelivered"). When B comes online, the Chat Gateway B connects to drains that queue and pushes everything through the fresh WebSocket.
3. **Why not one global queue?** A single shared queue means every gateway instance would need to scan all messages to find the ones addressed to its connected users — expensive and doesn't scale. Partitioning by recipient means a gateway only ever needs to ask "what's pending for the users I currently hold sockets for."
4. **Delivery vs. read receipts** are two different acknowledgments flowing back the other way: "delivered" fires when the message reaches the recipient's device (client sends an ack over the same socket); "read" fires when the recipient opens the chat. Both are just small control messages routed the same way, written back to the Message Store so the sender's client can update the tick marks next time it polls or receives a push.

### 4.2 Online presence: heartbeat + Redis

Presence looks simple ("is the user online?") but is deceptively expensive at scale because it changes constantly and everyone's contact list wants to know about everyone else's status.

```
Client ──(heartbeat every ~30s)──► Chat Gateway ──► Redis: SET presence:user_42 "online" EX 45
Client closes app / socket drops ──► Chat Gateway ──► Redis: DEL presence:user_42
                                                        (or let the TTL expire if the drop is silent)
```

- Presence is stored with a **short TTL** (e.g. 45 seconds) refreshed by each heartbeat. If the client crashes without a clean disconnect, the key simply expires — no explicit cleanup logic needed. This is the same eviction idea as Phase 06 Lesson 02's TTL-based expiry, just applied to presence instead of cached data.
- Presence is intentionally **eventually consistent** — it is completely fine (and expected in the real WhatsApp/Telegram products) for "last seen" to lag by a few seconds. Trying to make presence strongly consistent across hundreds of millions of users would mean paying a consistency tax on a feature nobody needs to be perfectly accurate.
- **Fan-out of presence changes** (so your contact list updates when a friend comes online) uses the pub/sub pattern from Phase 07 Lesson 03: a presence change publishes an event; only gateways holding sockets for that user's contacts need to care, so this is filtered, not broadcast to everyone.

### 4.3 End-to-end encryption (mentioned at a high level only)

Production chat apps encrypt message content client-side (e.g. the Signal Protocol) so that even the Message Store only ever holds ciphertext — the server routes and stores bytes it cannot read. This changes nothing about the architecture above (queues, presence, and delivery all operate on opaque blobs); it only changes what's *inside* the blob. Deriving the actual key-exchange protocol is out of scope for an HLD interview — naming it and explaining "the server never sees plaintext, key exchange happens client-to-client" is a sufficient answer.

## 5. Trade-offs / what breaks at 10x scale

- **A single Redis instance for presence** becomes a bottleneck and a single point of failure well before 5 billion DAU-equivalent heartbeats/day — the fix is the same one from Phase 05 Lesson 03: shard presence by `user_id` hash across a Redis cluster.
- **Message Store hot partitions** — if sharding is naive (e.g. by `sender_id` alone), a viral group or a bot account sending millions of messages can overload one shard. The fix is sharding by a composite/hashed key and monitoring for hot shards (Phase 09 Lesson 01).
- **Cross-region delivery latency** — once users span continents, a message from Mumbai to São Paulo crossing a single message store's home region adds hundreds of milliseconds. At real WhatsApp scale this pushes toward regional message stores with cross-region replication and accepting eventual consistency for cross-region delivery confirmations (foreshadowing Phase 12 Lesson 03's multi-region discussion).

## Interview Q&A

**Q: Why write the message to storage before attempting delivery, instead of just pushing it over the socket first?**
Answer: If the push fails or the recipient's socket drops mid-send, an in-memory-only message is gone forever. Persisting first means delivery becomes a retryable, idempotent step against durable data — the message can always be redelivered from the store, satisfying the "never lose a message" requirement.

**Q: How do you know which server holds a given user's WebSocket connection?**
Answer: A shared, low-latency lookup (Redis) maps `user_id → gateway_instance_id`, updated on connect/disconnect. Any gateway that needs to deliver a message to that user asks Redis first, then either delivers locally (if it holds the socket) or forwards the message to the correct gateway instance.

**Q: Why is presence eventually consistent instead of strongly consistent?**
Answer: Presence changes extremely frequently (every connect/disconnect/heartbeat) and is read by many contacts at once; the cost of coordinating strong consistency across that volume vastly outweighs the value, since users don't need "last seen" to be accurate to the millisecond. It's a deliberate availability-over-consistency trade-off (Phase 09's CAP framing).

**Q: How would you scale this to support group chats?**
Answer: Fan the outgoing message to a queue per group member instead of one recipient — write once to the Message Store, then enqueue N delivery jobs (one per online/offline member), reusing the exact per-user delivery queue mechanism from the 1:1 case. The hard new problem is large groups (thousands of members) turning one message into thousands of fan-out writes — the same fan-out-on-write cost problem covered in the next lesson on Instagram.

**Q: What happens if a message is delivered twice due to a retry?**
Answer: Each message carries a unique message ID generated by the sender's client. The recipient's client (and the Message Store) can deduplicate on that ID, so an at-least-once delivery guarantee from the queue doesn't turn into a user-visible duplicate message.
