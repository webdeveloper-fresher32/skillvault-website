# Monitoring and Interview Capstone

Phase 2 Lesson 3 raised a question it deliberately left open: what happens if a webhook never arrives at all? This lesson closes that loop with production monitoring and reconciliation, then closes the course itself with an interview-answer framework that draws on the shared checkout shape from Phase 1 rather than any single provider's syntax.

## 1. Monitoring Webhook Delivery Health

A payment integration can look healthy from the checkout side (customers completing payment) while quietly failing on the fulfillment side, if webhooks aren't arriving or aren't being processed. Phase 2 Lesson 1 established that the webhook, not the client-side redirect, is the authoritative signal that a payment actually happened server-side — which means webhook delivery health is itself a production metric worth tracking, not an implementation detail to only think about while debugging.

Concretely, track and alert on:

- **Webhook receipt rate vs. expected volume** — a sudden drop suggests either a provider-side outage or a misconfigured/expired endpoint, not necessarily a drop in real customer traffic.
- **Signature verification failure rate** — Phase 2 Lesson 2's constant-time comparison either passes or throws; a spike in failures can mean a rotated secret that wasn't updated in your environment, or (for PayPal specifically, per Phase 5 Lesson 3) a transient auth failure against the verification API rather than genuine forgery.
- **Handler error rate after verification succeeds** — Phase 2 Lesson 3's pattern of "verify → dedupe → enqueue → return 2xx fast" means a slow or failing downstream job doesn't show up as a webhook problem at all unless it's tracked separately from the initial 2xx response.
- **Dead-letter / permanently-failed events** — if a queued job tied to a webhook event exhausts its own retries, that failure needs its own alert, since the provider will eventually stop retrying delivery of the original webhook once your endpoint has returned 2xx.

```
// Illustrative alerting pseudocode, provider-agnostic.
const receivedLastHour = countWebhookEvents({ window: "1h" });
const expectedBaseline = rollingAverage("webhookEventsPerHour", days: 7);

if (receivedLastHour < expectedBaseline * 0.5) {
  alert("Webhook receipt rate dropped >50% vs. 7-day baseline — check endpoint health and provider status page");
}

const verificationFailureRate = countVerificationFailures({ window: "1h" }) / receivedLastHour;
if (verificationFailureRate > 0.01) {
  alert("Webhook signature verification failure rate above 1% — check for a rotated secret");
}
```

## 2. Reconciliation Jobs as a Safety Net

Monitoring catches problems as they happen; reconciliation catches the ones that slipped through anyway — including the exact scenario Phase 2 Lesson 3 left open, a webhook that never arrives at all (provider-side delivery failure, an endpoint that was briefly down and exhausted the provider's own retry window, or a network partition that dropped the request with no trace on either side).

The pattern: periodically compare your own database's view of pending/in-flight orders against the provider's API, and flag anything that's stale on your side but resolved on theirs.

```
// Illustrative reconciliation job pseudocode, provider-agnostic.
function reconcilePendingOrders(providerClient, thresholdMinutes = 30) {
  const staleOrders = db.orders.find({
    status: "pending",
    createdAt: { $lt: now() - thresholdMinutes * 60 * 1000 },
  });

  for (const order of staleOrders) {
    const providerState = providerClient.getOrderStatus(order.providerOrderId);

    if (providerState === "succeeded" && order.status !== "succeeded") {
      flagMismatch(order, providerState, reason: "webhook likely never arrived or was lost");
      // Safe to reconcile forward: mark succeeded and (re)trigger fulfillment,
      // guarded by the same idempotency-by-event-ID pattern as Phase 2 Lesson 3.
    } else if (providerState === "failed" && order.status === "pending") {
      flagMismatch(order, providerState, reason: "abandoned or declined, safe to close out");
    } else if (providerState === "pending") {
      // Still genuinely in-flight; not a mismatch, leave it alone.
      continue;
    }
  }
}
```

This job is the safety net for exactly the case Phase 2 Lesson 3 didn't resolve: it doesn't matter *why* a webhook never arrived, because the reconciliation job doesn't depend on the webhook arriving at all — it asks the provider directly. It's also a natural place to apply the GET-status-before-retry pattern Phase 1 Lesson 3 required for Razorpay's Orders API, since Razorpay has no general-purpose idempotency header to lean on there.

## 3. Interview Framework and a Worked Example

Payment-integration questions in interviews tend to take one of three shapes: "design a checkout flow," "how would you handle a webhook that arrives twice," or "how would you support two different providers behind one interface." All three are really testing whether a candidate understands the shared shape underneath any single provider's API, which is the same shape Phase 1 Lesson 1 opened this course with.

A framework for structuring an answer to any of them:

1. **Start with the provider-agnostic shape.** State the universal steps (create → collect → confirm, per Phase 1 Lesson 1) before naming any provider-specific object or field.
2. **Name the trust boundary.** Identify what the client can and can't be trusted to report (Phase 1 Lesson 1's tampering risk; Phase 2 Lesson 1's client-redirect-isn't-proof problem), and where the authoritative signal actually comes from (the webhook, confirmed by signature, per Phase 2 Lesson 2).
3. **Address delivery guarantees explicitly.** At-least-once, not exactly-once, delivery (Phase 2, Lesson 3) — so idempotent handling by event ID is not optional.
4. **Only then bring in provider specifics**, and frame them as different vocabulary for the same shape (Phase 1, Lesson 1's Interview Q&A) rather than fundamentally different problems — e.g., mapping each provider's own status field onto one internal enum, the same pattern Phase 6 Lesson 1's Common Mistakes section recommended for subscription statuses.
5. **Close with the safety net.** Mention reconciliation as the backstop for whatever the webhook path might miss — this is the detail that separates "I've read the docs" from "I've operated this in production."

**Worked example — "Design a payment flow that supports both Stripe and Razorpay behind one interface":**

- Start from the shared 3-step shape: create a payment/order object server-side with amount and currency, collect the payment method client-side through a hosted widget so raw card data never touches your server, then confirm/capture server-side (`PaymentGateways/Phase-01-Payment-Fundamentals/01-The-Checkout-Flow-Shape.md`).
- Define one internal interface — e.g. `createOrder(amount, currency)`, `verifyPaymentCallback(payload)`, `handleWebhook(rawBody, signatureHeader)` — and implement it once per provider, mapping Stripe's `PaymentIntent` object (`PaymentGateways/Phase-03-Stripe-Integration/01-Payment-Intents-and-Checkout-Sessions.md`) and Razorpay's `Order` object plus its extra client-side signature check (`PaymentGateways/Phase-04-Razorpay-Integration/01-Orders-API-and-Razorpay-Checkout.md`, `PaymentGateways/Phase-04-Razorpay-Integration/02-Client-and-Server-Signature-Verification.md`) onto the same internal shape, following the same don't-hardcode-one-provider's-vocabulary caution Phase 1 Lesson 1 raised.
- Verify each provider's webhook using its own mechanism — Stripe's `stripe.webhooks.constructEvent` over `Stripe-Signature` (`PaymentGateways/Phase-03-Stripe-Integration/03-Stripe-Webhooks-in-Practice.md`) and Razorpay's HMAC-SHA256-over-raw-body with its separate webhook secret (`PaymentGateways/Phase-04-Razorpay-Integration/03-Razorpay-Webhooks-in-Practice.md`) — but normalize both into the same internal event shape (`orderId`, `status`, `providerEventId`) before it reaches business logic, deduplicating by that event ID per the at-least-once pattern (`PaymentGateways/Phase-02-Webhooks-and-Event-Processing/03-At-Least-Once-Delivery-and-Idempotent-Handlers.md`).
- Add a reconciliation job (this lesson, Section 2) that polls both providers' order-status APIs for anything stuck `pending` past a threshold, so a lost webhook from either provider doesn't silently strand an order.

This example deliberately spends most of its structure on the shared shape and only briefly touches provider syntax — reflecting that jumping straight to API calls before establishing the provider-agnostic shape is the exact mistake described below.

## Comparison

| Aspect | Monitoring | Reconciliation | Interview framing |
|---|---|---|---|
| What it catches | Delivery/verification/handler failures as they happen | Orders where a webhook never arrived at all, discovered after the fact | Whether a candidate understands the shape (Phase 1) before the syntax |
| Primary signal | Receipt rate, verification failure rate, handler error rate | Mismatch between local `pending` state and provider's actual order status | Structure of the answer, not provider trivia |
| Depends on webhook arriving? | Yes — it's measuring webhook health itself | No — it queries the provider directly, so it works even if the webhook is lost | N/A — a framework, not a running system |
| Course anchor | Phase 2, Lessons 1–3 (client redirect isn't proof; signature verification; at-least-once delivery) | Phase 2, Lesson 3 (the "what if it never arrives" question left open there) | Phase 1, Lesson 1 (shared checkout shape); Phase 6, Lesson 1 (status-mapping pattern) |
| Failure mode if skipped | Silent delivery degradation goes unnoticed until a customer complains | Silently lost orders when a webhook permanently fails to arrive or be delivered | Jumping to provider-specific API calls, missing the trust-boundary and idempotency points an interviewer is probing for |

## Common Mistakes

- Having webhook handling but no reconciliation job, silently losing orders when a webhook delivery permanently fails — Phase 2 Lesson 3 raised this exact gap, and this lesson's reconciliation job is the answer it deliberately left open.
- Alerting only on total webhook volume and missing signature-verification-failure spikes, which can indicate a rotated secret that was never updated in your environment rather than a traffic change.
- Treating a PayPal webhook verification failure identically to a Stripe or Razorpay one — Phase 5 Lesson 3 noted PayPal's API-based verification can fail on a transient auth/network issue, not only genuine forgery, so alerting logic needs to distinguish the two rather than treating every failure as a security incident.
- In an interview setting, jumping straight to provider-specific API syntax (e.g., naming Stripe's exact endpoint names) before establishing the provider-agnostic shape an interviewer is actually assessing — this framework's step 1 exists specifically to avoid that.
- Running a reconciliation job without applying the same idempotency-by-event-ID discipline to whatever it triggers (e.g., re-sending a fulfillment email) — a reconciliation job that "catches up" a stuck order still needs to avoid double-processing if a delayed webhook for the same event arrives moments later.

## Hands-On Exercises

1. **Design the reconciliation job's pseudocode.** Write pseudocode for a job that compares local `pending` orders older than 30 minutes against the provider's API and flags mismatches, following the structure in Section 2 above but for a `refund`-status field instead of order status.
2. **Design a webhook-health alert.** Define one alert condition (a metric, a threshold, and what it implies) for each of: receipt rate, signature verification failure rate, and downstream handler error rate.
3. **Draft an interview answer outline.** For the prompt "how would you handle a webhook that arrives twice," write a five-line outline following this lesson's framework, citing Phase 2 Lesson 3 for the idempotency mechanism.
4. **Spot the missing safety net.** A team has webhook handling that's fully idempotent and well-tested (per Phase 2, Lesson 3, and this course's Lesson 2 test matrix), but no reconciliation job. Explain in two or three sentences what gap remains and why passing all webhook tests doesn't close it.
5. **Rewrite a syntax-first answer.** Given a hypothetical candidate answer that opens with "First, call `stripe.paymentIntents.create()`...", rewrite the opening two sentences to instead start from the provider-agnostic shape, per this lesson's framework step 1.

## Interview Q&A

**Q: How would you monitor payment webhook health in production?**
A: Track receipt rate against a rolling baseline, signature verification failure rate, and downstream handler error rate as three separate metrics — a spike in any one points to a different root cause (provider outage, a rotated secret, or a broken background job respectively), and none of them are visible from the client-side success screen alone.

**Q: What happens if a webhook is delivered late enough, or not at all, that your database and the provider's records disagree?**
A: That's exactly what a reconciliation job is for — periodically compare orders your database still shows as `pending` past a reasonable threshold against the provider's own order-status API, and treat any mismatch as a signal to catch up your local state rather than assuming the webhook will eventually arrive.

**Q: How would you design a payment flow that supports two providers behind one interface?**
A: Start from the shared create/collect/confirm shape (`Phase-01-Payment-Fundamentals/01-The-Checkout-Flow-Shape.md`), define one internal interface, implement it once per provider mapping each provider's own objects and webhook verification onto that shape, normalize both providers' events into one internal event shape before business logic sees them, dedupe by event ID, and back the whole thing with a reconciliation job.

**Q: Why shouldn't you jump straight into provider-specific API calls when answering a payment-design interview question?**
A: Because the interviewer is typically assessing whether you understand the underlying shape — the trust boundary, delivery guarantees, and idempotency — not whether you've memorized a specific provider's method names; starting with the shape and only then layering in provider syntax demonstrates the deeper understanding.

**Q: What's the risk of having idempotent webhook handling but no reconciliation job?**
A: Idempotency protects against processing the same webhook twice, but it does nothing for a webhook that never arrives at all — without a reconciliation job comparing your database against the provider's actual state, an order can get silently stuck as `pending` forever with no automated way to catch it.
