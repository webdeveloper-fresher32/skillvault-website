# Mock Interview Walkthrough: Design a Notification Service

Reading a framework is not the same as watching it survive contact with an actual interviewer — someone who interrupts, pushes back, and asks the one question you didn't prepare for. This lesson is a full, worked transcript of a 45-minute system design interview for the prompt "Design a Notification Service," applying every step from Lesson 01 live. Read it once straight through for the shape of a strong answer, then re-read it against the framework, checking off each step as the candidate hits it.

The interviewer's pushback in this transcript is realistic, not softballed — that's deliberate. Candidates who only ever rehearse against an agreeable imaginary interviewer get caught off guard by a real one.

---

## The transcript

**Interviewer:** Let's design a notification service. Take it wherever you think makes sense — I'll jump in with questions along the way.

**Candidate:** Sounds good. Before I start drawing anything, I want to nail down scope and scale, since "notification service" can mean a lot of different things. A few questions: which channels do we need to support — push, email, SMS, in-app, some combination? Who triggers a notification — is it always another internal service, like "order shipped," or can end users also directly message each other through this?

**Interviewer:** Good question. Let's say push notifications and email, triggered by other internal services — things like "your order shipped," "someone liked your post." No user-to-user messaging.

**Candidate:** Got it. Next, on scale — what's a reasonable user base and notification volume to design for? And is there a strict latency requirement, like "must arrive within 2 seconds," or is "eventually, within a reasonable time" acceptable?

**Interviewer:** Let's say 50 million daily active users. Latency isn't super strict — a few seconds to a minute is fine for most notification types, this isn't a life-safety alerting system.

**Candidate:** That's helpful — it tells me we can lean towards throughput and reliability over raw speed. Last clarifying question: what happens if we occasionally send a duplicate notification, versus occasionally miss one entirely? I want to know which failure mode is more acceptable, since that drives some of the consistency decisions later.

**Interviewer:** Missing one entirely is worse than a duplicate. A user getting "your order shipped" twice is mildly annoying; never getting it at all is a real support complaint.

**Candidate:** Perfect, that's a clear signal — I'll bias towards at-least-once delivery with deduplication on a best-effort basis, rather than trying to guarantee exactly-once, which is much more expensive. Let me state my assumptions back before moving on: 50 million DAU, push and email only, triggered by internal services, best-effort latency of a few seconds to a minute, and at-least-once delivery preferred over risking a dropped notification.

**Interviewer:** Agreed, go ahead.

**Candidate:** Now let me do a quick back-of-envelope estimate before I design anything, so the numbers drive the architecture instead of guessing. Let's say each user gets an average of 3 notifications a day — some days more, some zero.

```
50,000,000 users × 3 notifications/day = 150,000,000 notifications/day

150,000,000 / 86,400 seconds ≈ 1,740 notifications/sec average

Real traffic isn't flat — assume peak is roughly 5x average
(e.g. a flash sale, a viral post, a morning login spike):
1,740 × 5 ≈ 8,700 notifications/sec peak
```

**Candidate (continuing):** And for storage — if I keep a record per notification for delivery-status tracking and debugging, at roughly 0.5 KB per record (user ID, channel, payload, status, timestamps):

```
150,000,000/day × 0.5 KB ≈ 75 GB/day
75 GB/day × 365 ≈ ~27 TB/year
```

**Candidate (continuing):** That 27 TB/year is mostly write-once, rarely-read audit data, so I'll flag now that I don't want it living forever in whatever database serves the hot path — I'd want a retention policy or a move to cold storage after some window, maybe 90 days. I'll come back to that if we have time.

**Interviewer:** Noted. Keep going.

**Candidate:** Now the high-level architecture. At a shape level:

```
Internal Services (Orders, Social, etc.)
        │  "send notification" event
        ▼
   Notification API  ──────►  Preferences DB (Postgres)
        │
        ▼
     Message Queue
        │
   ┌────┴────┐
   ▼         ▼
Push Worker  Email Worker
   │             │
   ▼             ▼
 APNs/FCM      SMTP/SES
```

**Candidate (continuing):** Internal services call a Notification API — a thin service whose only job is to accept "send this notification" requests, check the user's preferences and opt-outs against Postgres, and drop a message onto a queue rather than sending anything synchronously. I'm doing that because sending is inherently slow and unreliable — a third-party push gateway or SMTP server can be down or slow, and I don't want the caller (say, the Orders service) blocked waiting on that. That's the async-processing pattern — decouple the trigger from the slow side effect.

From the queue, I have separate worker pools per channel — a Push Worker pool and an Email Worker pool — because they talk to completely different downstream providers (APNs/FCM for push, SMTP/SES for email) with different failure modes and rate limits, and I don't want a Push provider outage to back up email sending or vice versa.

For the Preferences DB, I'm using Postgres rather than a NoSQL store because this data is small, relational (user → channel preferences, opt-outs), and read far more often than written — a classic case for a normal relational database with a read replica once traffic grows, rather than anything exotic.

**Interviewer:** Why a queue instead of just calling the Push and Email providers directly from the Notification API?

**Candidate:** A few reasons. First, decoupling — if APNs is slow or down, I don't want that latency or failure propagating back to the Orders service that triggered the notification; it already got its "accepted" response and moved on. Second, the queue gives me a natural place to retry — if a send fails, the worker can requeue it with backoff instead of the caller having to implement retry logic itself. Third, it smooths out bursts — at that 8,700/sec peak, workers can drain the queue at a sustainable rate instead of every worker instance needing to be provisioned for the absolute peak at all times.

**Interviewer:** Okay. Let's go deeper — walk me through what happens when the same "order shipped" event gets published twice because the Orders service retried after a network timeout, even though the first request actually succeeded.

**Candidate:** This is exactly the deduplication problem, and I think it's one of the two hardest parts of this system, so let me go deep here. The core idea is an **idempotency key**. When the Orders service calls the Notification API, it should include a key that uniquely identifies this *logical* notification event — something like `order_id + "shipped"`, not a random UUID generated per HTTP call, since a retried call needs to produce the *same* key both times for dedup to work.

```
POST /notifications
{
  "idempotency_key": "order_42981-shipped",
  "user_id": 10345,
  "channel": "push",
  "template": "order_shipped",
  "data": { "order_id": 42981 }
}
```

The Notification API checks this key against a table (or a Redis set with a TTL, since we mainly need to catch retries that happen within minutes, not years) before enqueueing. If the key's already been seen, it returns success immediately without enqueueing a second time — from the Orders service's point of view, the retry is harmless. If the check-and-insert needs to be atomic to avoid a race between two near-simultaneous retries, I'd do the existence-check and insert as a single conditional write — in Postgres that's an `INSERT ... ON CONFLICT DO NOTHING` against a unique constraint on the key, or in Redis a `SETNX`.

**Interviewer:** What if the duplicate arrives *after* the first one has already been dequeued and sent — say, five minutes later, after your dedup TTL in Redis has already expired?

**Candidate:** Good catch — that's the gap in a TTL-based approach. Two options: extend the TTL comfortably past any realistic retry window the Orders service would use — if their retry logic gives up after, say, 30 seconds, a 10-minute TTL is generous — or, more robustly, don't rely on TTL at all and instead keep the idempotency key permanently in the same durable store as the notification record itself, which we're already writing for delivery-status tracking. I'd lean towards the second option in a real system, since the storage cost of a permanent key-existence check is small compared to the cost of an actual duplicate reaching a user, and it removes the TTL-tuning guesswork entirely.

**Interviewer:** Makes sense. What's the second hard part you mentioned?

**Candidate:** Fan-out and retry behavior per channel, specifically making sure a slow or failing provider doesn't cascade. Each worker pool pulls from its own queue, sends via the provider, and on failure requeues with exponential backoff — say 1s, 2s, 4s, 8s — rather than retrying immediately in a tight loop, which would just hammer an already-struggling provider. After some fixed number of retries, maybe 5, the message goes to a dead-letter queue instead of being retried forever, and that DLQ gets alerted on so a human notices a provider is persistently broken rather than the message silently vanishing.

The other piece here is that Push and Email genuinely need separate queues and separate worker pools, not one shared queue with a `channel` field, precisely because I don't want a Push provider outage — APNs having a bad day — to back up the queue for Email, which has nothing to do with it. Isolating failure domains per channel is the whole point of splitting them.

**Interviewer:** Let's talk scale. What breaks first if this grows 10x — 500 million users instead of 50 million?

**Candidate:** A few things, in rough order of when they'd hurt:

The queue and worker layer is the first bottleneck — at roughly 87,000 notifications/sec peak instead of 8,700, a single queue and a fixed worker pool won't keep up. The fix is horizontal: shard the queue, likely by user ID hash or by channel, and scale worker instances independently per shard — this is the same horizontal scaling pattern from earlier in the course, just applied to workers instead of API servers.

Second, the Preferences DB. At 50M users it's comfortably served by Postgres with a read replica. At 500M, if read volume outgrows what replicas can absorb, I'd look at sharding it — probably by user ID range or hash, similar to how you'd shard any other large user table — though I'd want to confirm reads-per-second before committing to that; it's possible a well-cached read replica setup still holds.

Third, the write volume for the notification-status audit table — at 27 TB/year at 50M users, that's roughly 270 TB/year at 500M. That table needs a retention/archival policy regardless of scale, but at this size it becomes non-negotiable — old records move to cheap cold storage after a short retention window, and only recent records stay in the hot, queryable store.

**Interviewer:** If you had to choose between availability and strict consistency for the preferences check — say, during a network partition between the Notification API and the Preferences DB — which would you pick, and why?

**Candidate:** Availability, with a safe default. If I can't reach the Preferences DB to check opt-outs, I'd rather degrade to a cached or default preference state and still attempt delivery — worst case, someone who opted out of push gets one anyway, which is a minor annoyance — than block sending entirely and risk the "missed notification" failure mode we agreed earlier is the worse outcome. That's consistent with the requirement we set at the start: a duplicate or slightly-stale preference check is more acceptable here than a dropped notification. I'd flag, though, that this is a case-by-case call — for something like a marketing-opt-out where sending anyway has legal implications, I'd flip that default towards blocking instead.

**Interviewer:** Good. We're getting close to time — anything you'd want to add if we had another few minutes?

**Candidate:** Two things, briefly. First, I'd want monitoring specifically on queue depth per channel and delivery success rate per channel — those are the earliest symptoms of a provider outage or a worker pool falling behind, well before it becomes a user-visible complaint. Second, I'd revisit that 90-day retention idea concretely — move notification records older than 90 days from the primary store into cheaper cold storage, keeping only aggregate delivery-rate metrics indefinitely, so the hot store doesn't grow unbounded as we scale.

**Interviewer:** Great, I think that's a solid stopping point. Thanks — that was a strong walkthrough.

---

## What made this a strong answer

- The candidate **never designed anything before scoping it** — every clarifying question narrowed the problem instead of being a formality.
- Estimation numbers **showed up again later** — the 8,700/sec peak directly justified the sharding discussion at 10x, instead of being a disconnected warm-up exercise.
- The deep dive went to the two genuinely hard sub-problems (dedup, fan-out/retry isolation) instead of re-explaining the box diagram in more detail.
- When pushed on the TTL gap, the candidate **updated the design on the spot** instead of defending the original answer reflexively — this is what separates confident flexibility from stubbornness.
- The CAP-style pushback got a **concrete, scoped answer** ("availability, with this specific fallback, except for this one case") rather than a vague "it depends."
- The candidate used the last available time to **volunteer** monitoring and retention follow-through, rather than needing to be asked.
