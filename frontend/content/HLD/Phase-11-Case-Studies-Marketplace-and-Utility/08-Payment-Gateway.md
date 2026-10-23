# Design a Payment Gateway

A customer's app hits "Pay $49.99." The network stalls, the client sees a timeout, and — not knowing whether the charge went through — retries the exact same request. If the first request actually did succeed server-side and this retry charges the card a second time, that's not a bug you can shrug off like a duplicated like on a social post; it's real money taken from a real customer twice. Every design decision in this lesson exists to make that scenario impossible.

## 1. Requirements

**Functional**
- Accept a payment request (amount, currency, payment method, merchant/order reference) and either charge the customer or return a clear failure reason.
- Guarantee a retried request for the same logical payment is never processed twice, even if the client can't tell whether its first attempt succeeded.
- Reliably notify the merchant's system once a payment succeeds or fails, so order fulfillment can proceed.
- Support refunds against a previously successful payment.

**Non-functional**
- **Strong consistency, non-negotiable** — this is the other canonical case (alongside hotel/flight booking) where "eventually consistent" is simply the wrong answer; a payment's success/failure state must be exact and durable the instant it's decided.
- **Exactly-once effect, even over an unreliable network** — the request may be delivered zero, one, or many times (client retries, load balancer retries, network partition), but the *financial effect* must happen exactly once.
- **Latency target:** payment decision (approved/declined) in 1-3 seconds, most of which is typically the round-trip to an external card network/bank, not this system's own processing.
- **Scale target:** correctness under retry and failure dominates the design far more than raw throughput — a payment gateway processing "only" a few hundred transactions/sec still needs airtight guarantees, unlike a social feed where an occasional dropped like is a non-issue.

## 2. Back-of-envelope estimation

Assume a mid-sized platform processing 20 million payments/month:

- Payments/sec average: 20,000,000 ÷ (30 × 86,400) ≈ **~7.7/sec**, spiking several-fold during sales events (call peak ~50-80/sec) — genuinely modest volume; this system is not throughput-constrained the way a feed or a location firehose is.
- Retry overhead: assume a conservative 2% of requests are client-side retries of an already-processed payment (timeouts, flaky mobile networks) — at 20M/month that's 400,000 retry attempts/month that the idempotency layer (deep dive below) must catch and short-circuit rather than reprocess.
- Storage: a payment record (amount, currency, method, status, idempotency key, timestamps) at ~1KB, 20M/month → 20GB/month ≈ **~240GB/year** — trivial; again, correctness under concurrency and failure is the actual design constraint, not storage or raw throughput.

## 3. High-level architecture

```
   Client/Merchant ───────────▶ ┌────────────────────┐
                                │   API Gateway         │  (Phase 08 L02)
                                └──────────┬───────────┘
                                           │  request carries an
                                           │  Idempotency-Key header
                                           ▼
                                ┌────────────────────┐
                                │  Payment Service       │
                                │  (checks idempotency     │
                                │   key first, before doing │
                                │   any actual charging)     │
                                └──────────┬───────────┘
                                           │
                     ┌───────────────────────┼───────────────────────┐
                     ▼                                                ▼
          ┌────────────────────┐                          ┌────────────────────┐
          │  Postgres              │                          │  External payment       │
          │  (payments table +      │◀── same transaction ──▶│  processor / card         │
          │  outbox table,            │                          │  network (Visa/Stripe-    │
          │  Phase 05 L04)             │                          │  style API)                 │
          └──────────┬───────────┘                          └────────────────────┘
                     │  outbox poller/relay
                     ▼
          ┌────────────────────┐
          │  Message queue          │  (Phase 07) — publishes
          │  (payment.succeeded/      │  "payment succeeded" for
          │   payment.failed events)   │  order fulfillment, receipts,
          └────────────────────┘  notifications to react to
```

- The **Payment Service** is backed by a relational database with real transactions (Phase 05 Lesson 04) — chosen deliberately over the NoSQL-for-scale default used elsewhere in this course, because the requirement here is exact, durable, transactional correctness on a modest volume, not horizontal write throughput on a massive one. This is the explicit callback to Phase 05 Lesson 04's SQL-vs-NoSQL framing: pick the tool the requirement demands, not the one that scales the furthest on paper.
- Every payment attempt is checked against its **idempotency key** before any charge is attempted (deep dive below), and every state-changing outcome is written to an **outbox table** in the same database transaction as the payment record itself, then relayed onto a **queue** for downstream consumers (order fulfillment, receipts, notifications) — the outbox pattern, also detailed below.

## 4. Deep dive

**Idempotency keys.** The client generates a unique idempotency key (typically a UUID) once, when the user first taps "Pay," and sends it with the payment request. If the network fails and the client retries, it sends the *same* key again. The Payment Service's very first step — before touching the card network at all — is: "have I seen this idempotency key before?" This is implemented as a unique constraint on the idempotency key column in the payments table:

1. Attempt to insert a new payment row with `status = PENDING` and the given idempotency key, inside a transaction.
2. If the insert succeeds (key not seen before), proceed to actually charge the card, then update the row to `SUCCEEDED`/`FAILED` based on the result.
3. If the insert fails on the unique-constraint violation (key already exists), **do not charge the card again** — instead, look up the existing row and return its current status/result to the caller. If that existing row is still `PENDING` (the original request is genuinely still in flight, not yet resolved), the safe answer is to tell the retrying client to wait/poll rather than starting a second concurrent charge attempt.

This turns "the network is unreliable and requests can arrive more than once" from a correctness landmine into a solved, boring case — the database's own uniqueness guarantee is what makes it airtight, the same principle Lesson 03 (Hotel Booking) used a range-exclusion constraint for: push the guarantee into the schema, don't rely on application code remembering things correctly under concurrency.

**The outbox pattern for reliably publishing "payment succeeded" events.** Once a payment succeeds, the merchant's order-fulfillment system, a receipt-email service, and other consumers need to be told. The naive approach — update the payment row to `SUCCEEDED`, then separately publish an event to a message queue — has a gap: if the process crashes *between* the database commit and the queue publish, the payment is durably marked succeeded but no one downstream is ever told, silently stranding an order. The outbox pattern closes this gap by writing the "event to publish" into an **outbox table in the very same database transaction** as the payment-status update — so either both happen (payment succeeded and the event-to-publish is recorded) or neither does; there is no in-between state. A separate, simple relay process then polls the outbox table (or uses the database's change-data-capture stream) and publishes each row to the actual message queue (Phase 07), marking it published once confirmed — and because that relay step can itself be retried safely (publishing the same event twice is harmless if downstream consumers are themselves idempotent, or if the relay marks-published atomically), it doesn't need the same airtight care as the payment charge itself.

**Why SQL over the NoSQL choice used elsewhere in this course.** Phase 05 Lesson 04 framed the SQL-vs-NoSQL decision as: reach for SQL when you need strong consistency and transactions (the payment/booking case), reach for NoSQL when you need flexible schema and horizontal write scale at high volume (chat messages, feed data). A payment gateway is the textbook SQL case: volume is modest (single-digit to low-double-digit transactions/sec even at a mid-sized platform, per the estimation above), but the correctness bar — never double-charge, never lose track of a payment's true status, never let two concurrent steps see an inconsistent view of "has this been paid yet" — is the highest in the entire course. Transactions and unique constraints are exactly the tools a relational database gives you for free to meet that bar; rebuilding the same guarantees in a NoSQL store designed around eventual consistency would mean re-implementing exactly the mechanism a relational database already does natively.

## 5. Trade-offs / what breaks at 10x scale

- **A single primary Postgres instance for payments becomes a write bottleneck at 10x volume** — but because payment writes are naturally partitionable by merchant ID or account ID (Phase 05 Lesson 03's sharding), and no payment ever needs a cross-shard transaction with another merchant's payment, this scales out cleanly without weakening the consistency guarantees within a single payment.
- **The outbox relay/poller becomes a lag bottleneck** if a single poller can't keep up with 10x event volume — the fix is partitioning the outbox table (e.g., by merchant ID, same key as the sharding above) with multiple relay workers each owning a partition, rather than one poller draining the entire table serially.
- **External payment-processor/card-network latency dominates the end-to-end time** at any scale, and doesn't improve with more of this system's own infrastructure — the honest answer at 10x scale is the same as at 1x: this system's job is to be airtight around a call it doesn't control the speed of, and the design should focus on making that call idempotent and retry-safe rather than trying to architect around the external latency itself.

## Interview Q&A

**Q: How do you prevent a client's retried request from charging a customer twice?**
A: An idempotency key, generated once by the client and sent with every retry of the same logical request, enforced as a unique constraint on the payments table. Before ever attempting to charge a card, the service tries to insert a new row with that key; if the key already exists, it returns the existing payment's result instead of charging again — the database's uniqueness guarantee, not application logic, is what makes this airtight under concurrent retries.

**Q: What's the outbox pattern, and what specific failure does it prevent?**
A: It prevents the gap between "payment marked succeeded in the database" and "downstream systems told about it" from silently losing an event if the process crashes in between. By writing the payment-status update and the to-be-published event into the *same database transaction*, both changes commit atomically or neither does — a separate relay process then reliably drains the outbox table to the actual message queue, and that relay step is safe to retry since publishing is (or can be made) idempotent downstream.

**Q: Why does this system use a relational database when the rest of this course pushes toward NoSQL for scale?**
A: Because the requirement is different. NoSQL earns its place when you need horizontal write scale and can tolerate eventual consistency — true for chat messages or feed data, not true here. Payments need exact transactional correctness at modest volume, which is precisely what relational databases with real transactions and unique constraints are built for; using NoSQL here would mean manually rebuilding the same guarantees a relational database already provides.

**Q: What happens if a retried request arrives while the original request is still genuinely in progress (not yet succeeded or failed)?**
A: The idempotency-key lookup finds the existing row still in a `PENDING` state. The correct response is to tell the caller the payment is still processing (and to poll or wait) rather than starting a second concurrent charge attempt against the same idempotency key — starting a second attempt while the first is unresolved is exactly the double-charge risk the whole mechanism exists to prevent.

**Q: How would you handle a refund without reintroducing the same double-processing risk as the original payment?**
A: The same idempotency-key mechanism applies to refund requests independently — a refund request carries its own idempotency key, checked against a refunds table (or a refund-specific column on the payment) before actually reversing any funds, so a retried refund request is caught and short-circuited exactly the way a retried charge is, rather than needing a separate ad hoc mechanism.
