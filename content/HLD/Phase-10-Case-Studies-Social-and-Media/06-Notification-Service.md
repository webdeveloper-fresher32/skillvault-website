# Design a Notification Service

Every other case study in this phase eventually needs to *tell* a user something happened — a message arrived, a video finished processing, someone liked your post. A notification service is the shared infrastructure that makes that possible without every product team building their own push/email/SMS integration. It's less glamorous than a feed algorithm, but it shows up as its own interview question constantly, precisely because "how do you not double-notify someone and not lose a notification" is a genuinely hard reliability problem.

## 1. Requirements

**Functional requirements:**
- Any internal service (chat, feed, payments, etc.) can request a notification be sent to a user.
- Notifications can be delivered via multiple channels: push (mobile), email, SMS — a single logical notification may fan out to more than one channel based on user preference.
- Users can configure preferences per channel/notification type (e.g. "email me for security alerts, push-only for likes").
- Failed deliveries are retried; a notification is not silently dropped on a transient provider failure.

**Non-functional requirements:**
- **At-least-once delivery, with deduplication on the client/service side** — it is far worse to silently drop a security alert than to occasionally deliver one twice, so the system is explicitly biased toward "make sure it arrives" over "never duplicate," while still working to minimize duplicates.
- **Availability over strict consistency** — a notification arriving a few seconds late is fine; a service failure blocking the caller's main request path is not.
- **Latency target:** push notifications delivered within a few seconds of the triggering event; email/SMS within tens of seconds is acceptable.
- **Scale target:** design for 200 million notification-triggering events/day across all internal services combined.

## 2. Back-of-envelope estimation

- Events/day: 200,000,000 → events/sec average ≈ 200M / 86,400 ≈ **2,300/sec** average, higher at peak (e.g. a broadcast-style event like "app update available" sent to everyone in a short window can spike this far higher briefly).
- Assume average fan-out of 1.5 channels per notification (some users get push only, some get push + email) → **~3,500 channel-deliveries/sec** average across push/email/SMS combined.
- Storage: each notification record (recipient, channel, content, status, timestamps) ~1 KB → 200M × 1 KB/day = **200 GB/day** of notification/audit data, modest compared to the media-heavy case studies earlier in this phase — this system's hard problem is reliability, not scale of bytes.
- Retry overhead: assume a conservative 5% of deliveries need at least one retry (transient provider errors) → an extra ~175/sec of retry traffic layered on top of the base rate, which the queueing design below has to absorb without falling behind the primary delivery stream.

## 3. High-level architecture

```
Any internal service (chat, feed, payments, ...)
        │  "notify user 42: your payment succeeded"
        ▼
┌────────────────────┐
│ Notification API      │  ◄── thin, just validates + enqueues (Phase 07 async pattern)
└──────────┬──────────┘
           ▼
┌────────────────────┐
│ Preference Service     │  ── looks up which channels this user wants for this event type
└──────────┬──────────┘
           ▼
   ┌───────┴────────┬────────────────┐
   ▼                ▼                ▼
┌─────────┐   ┌─────────┐     ┌─────────┐
│ Push Queue │   │ Email Queue │     │ SMS Queue   │   (queue-per-channel — Phase 07)
└─────┬─────┘   └─────┬─────┘     └─────┬─────┘
      ▼               ▼                 ▼
┌───────────┐   ┌───────────┐   ┌───────────┐
│ Push Worker  │   │ Email Worker │   │ SMS Worker    │
│ → APNs/FCM   │   │ → SES/SendGrid│   │ → Twilio/SNS  │
└───────────┘   └───────────┘   └───────────┘
      │               │                 │
      └───────┬───────┴─────────┬───────┘
              ▼                 ▼
      ┌────────────────────────────┐
      │ Delivery Status Store         │  (dedup keys, retry counts, final status —
      │ (Redis for dedup + DB for log) │   Phase 05/06 patterns applied to reliability)
      └────────────────────────────┘
```

- **Notification API** does the minimum possible work synchronously — validate the request, enqueue it — and returns immediately, exactly like Phase 07 Lesson 01's async-processing pattern. The calling service (e.g. the payment service) never blocks on whether an email actually got delivered.
- **Queue-per-channel** rather than one shared queue: push, email, and SMS have wildly different latency profiles and failure modes (a flaky SMS provider shouldn't back up push delivery), so each channel gets its own queue and worker pool, scaled independently.

## 4. Deep dive

### 4.1 Fan-out to push/email/SMS providers, queue-per-channel

```python
@app.post("/notify")
def notify(event: NotificationEvent):
    channels = preference_service.channels_for(event.user_id, event.type)   # e.g. ["push", "email"]
    for channel in channels:
        enqueue(channel, event)          # push → Push Queue, email → Email Queue, etc.
    return {"status": "queued"}

# Per-channel worker, e.g. Push Worker:
@celery.task(bind=True, max_retries=5)
def send_push(self, event):
    try:
        push_provider.send(event.user_id, event.content)
        mark_delivered(event.notification_id, "push")
    except TransientProviderError:
        raise self.retry(countdown=backoff(self.request.retries))
```

- **Independent scaling per channel.** If email volume spikes (e.g. a marketing campaign) while push stays flat, only the Email Queue's worker pool needs to scale — exactly the independent-scaling benefit microservice-style decomposition gives you (Phase 02 Lesson 02), applied at the channel level within one logical service.
- **Provider abstraction.** Each worker talks to one or more third-party providers (APNs/FCM for push, SES/SendGrid for email, Twilio/SNS for SMS) behind a simple internal interface, so swapping providers or adding a failover provider doesn't touch the queueing/fan-out logic above it.
- **User preferences gate fan-out**, not delivery — the Preference Service decides *which* channels a given event type should go to for this user before anything is enqueued, so a user who opted out of email never generates email-queue traffic in the first place.

### 4.2 Deduplication and retry/backoff

This is the part of the system that actually justifies calling it "hard." Two failure modes have to be handled without contradicting each other: **don't drop a notification**, and **don't spam the user with duplicates**.

```
Every notification request carries an idempotency key (e.g. hash of user_id + event_id + channel)

Before enqueueing / before a worker sends:
    if idempotency_key already marked "sent" in Delivery Status Store (Redis, short TTL):
        skip — this is a duplicate (retry, double-publish upstream, etc.)
    else:
        proceed with send, then mark "sent" in Redis
```

- **Idempotency key, not a request ID.** The key is derived from *what* the notification is about (`user_id + event_id + channel`), not from the specific delivery attempt — so if the same underlying event gets published twice upstream (a common failure mode with at-least-once queues, per Phase 07), the second attempt is recognized as a duplicate and skipped, rather than sent again.
- **Retry with exponential backoff.** A transient provider failure (rate limit, momentary outage) triggers a retry after a growing delay (e.g. 1s, 2s, 4s, 8s...) rather than hammering the provider immediately and repeatedly. After a max retry count, the notification moves to a dead-letter queue for investigation rather than retrying forever.
- **At-least-once, deduplicated, is the practical target — not exactly-once.** True exactly-once delivery across an unreliable network and third-party providers is not achievable in general; the realistic goal is "delivered at least once, with a dedup layer that makes duplicates rare and mostly invisible to the user," which is what the idempotency-key check above achieves.
- **Status tracking** (queued → sent → delivered/failed, when the provider supports delivery confirmation) is written to a durable store so that a stuck or failed notification is visible to monitoring (Phase 09 Lesson 01) rather than silently disappearing.

## 5. Trade-offs / what breaks at 10x scale

- **A broadcast-style event** (e.g. "notify all 200M users about a policy update") at 10x scale can momentarily spike one channel's queue depth by orders of magnitude; the fix is either rate-limiting/throttling broadcast fan-out deliberately over a longer window, or pre-scaling worker pools ahead of a known broadcast (similar in spirit to Netflix's predictive pre-positioning from the previous lesson, applied to compute capacity instead of content).
- **Dedup store growth** — a Redis-based dedup key store with a short TTL works well at today's volume, but at 10x events/sec the working set of "recent idempotency keys" grows proportionally; the fix is the same sharding idea from Phase 05 Lesson 03 applied to the dedup store, or shortening the dedup TTL if the realistic duplicate-arrival window is well understood.
- **Third-party provider rate limits** don't scale with your traffic just because you want them to — at 10x volume, a single push/email/SMS provider account may simply hit its own rate limit regardless of how well your queues are architected; the fix is provider-side capacity negotiation and/or spreading load across multiple provider accounts or providers, which is an operational constraint this system's architecture alone can't solve.

## Interview Q&A

**Q: Why does each notification channel get its own queue instead of one shared queue for all notifications?**
Answer: Push, email, and SMS have very different latency and failure characteristics — a slow or degraded SMS provider shouldn't create backpressure that delays push notifications. Separate queues let each channel's worker pool scale and fail independently.

**Q: How do you prevent a user from receiving the same notification twice?**
Answer: Every notification carries an idempotency key derived from the underlying event (not the delivery attempt), checked against a short-TTL store before sending. If the same event is enqueued twice — a common at-least-once-queue failure mode — the duplicate is detected and skipped rather than delivered again.

**Q: Why is at-least-once delivery acceptable here, when exactly-once sounds better?**
Answer: True exactly-once delivery across unreliable networks and third-party providers isn't practically achievable, and for notifications, an occasional (deduplicated-away) duplicate is far less harmful than a silently dropped one — e.g. missing a security alert is worse than rarely seeing a "you have a new like" notification twice.

**Q: How would you handle a provider (e.g. the push notification service) being temporarily down?**
Answer: Workers retry with exponential backoff rather than failing immediately or retrying too aggressively, which would worsen an already-degraded provider. After a bounded number of retries, the notification is moved to a dead-letter queue and flagged for monitoring rather than retried indefinitely.

**Q: How would this system handle sending the same notification to 200 million users at once (a broadcast)?**
Answer: Rather than enqueueing all 200 million deliveries instantly, the fan-out is deliberately throttled/spread over a window (or worker capacity is pre-scaled ahead of a known broadcast), so the sudden queue depth spike doesn't overwhelm worker pools or trigger provider-side rate limits all at once.
