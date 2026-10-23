# Subscription Lifecycle

A one-off payment (Phases 1-5) has a short life: created, confirmed, done. A subscription is a payment that keeps happening on a schedule, which means it needs an explicit state machine — and the single most common recurring-billing bug is code that only ever expects two states, "paid" and "not paid," when providers actually model several states in between.

## 1. The Common State Machine

Every major provider converges on roughly the same shape, even though the exact status strings differ: a subscription can start in a trial, become active on successful billing, drop into a retriable failure state when a renewal charge fails, and eventually land in a terminal state if nothing recovers it.

```text
                 trial ends, first charge succeeds
   trialing ─────────────────────────────────────────► active
      │                                                   │  │
      │ trial ends, no usable                             │  │ renewal charge fails
      │ payment method                                    │  │
      ▼                                                   │  ▼
   past_due ◄─────────────────────────────────────────────┘ past_due
      │      (a renewal failure from "active" also lands here)
      │
      ├── retry succeeds ──────────────────────────► active
      │
      ├── all retries exhausted ─────────────────► unpaid / canceled (terminal,
      │                                              provider-configurable)
      │
      └── customer cancels at any point ─────────► canceled (terminal)
```

The two states that matter most in practice are `past_due` and the terminal state(s) after it. `past_due` means "a charge failed, but the subscription is still alive and retriable" — the customer still has access, by design, while the provider (and often your app) tries again. Only after retries are exhausted does the subscription move to a terminal state, which some providers model as a distinct `unpaid` status and others fold directly into cancellation — treat this distinction as configuration you must check for the account you're integrating, not a fact to memorize.

## 2. How Each Provider Models It (Conceptually)

All three providers in this course expose the same three trial/active/failure-retry/terminal ideas under provider-specific names. The exact object and field names below should be treated as the general shape you'll find in each provider's subscription/billing docs — verify exact field names against current docs before writing production code, since these details can change.

- **Stripe** models this as a Subscription object with a `status` field that moves through values conceptually equivalent to trialing → active → past_due → canceled (Stripe also has additional nuanced statuses beyond this core set — check current docs for the full list).
- **Razorpay** models recurring billing as a Subscription resource with its own status field, conceptually the same trial/active/failure-retry/terminal shape, reached via its own event names.
- **PayPal** models this as a Billing Plan (the reusable pricing/schedule template) paired with a Subscription resource created against that plan; the subscription resource carries a status conceptually equivalent to the same active/suspended-on-failure/canceled shape.

The important takeaway isn't the exact string values — it's that "successfully billing," "temporarily failed but retriable," and "permanently done" are three conceptually distinct states in every provider's model, and your application code needs to distinguish all three, not collapse them into a boolean.

## 3. Subscription Webhook Events (Building on Phase 2)

Phase 2 established that only a server-to-server webhook is authoritative for "did this actually happen" — that applies just as strongly here, because a subscription's state changes on the provider's schedule, not in response to any request your server makes. Your webhook handler is how you learn a trial converted, a renewal succeeded, a renewal failed, or a subscription was canceled — there's no client-side redirect involved in most of these transitions at all, since no customer is present when a renewal charge runs automatically. Apply Phase 2's idempotency lesson here too: subscription lifecycle webhooks are still subject to at-least-once delivery, so dedupe by event ID exactly as before.

```text
Provider's billing scheduler fires (no browser session involved)
        |
        v
Renewal charge attempted on file payment method
        |
        +--> succeeds --> webhook: "renewal succeeded" --> your handler keeps status active
        |
        +--> fails    --> webhook: "renewal failed"    --> your handler moves status to past_due
```

## 4. Modeling It in Code

The state machine above translates directly into a small transition function: a map of `{ state: { event: nextState } }`, plus a function that looks up the current state, checks the event is valid from there, and returns the new state — rejecting anything not explicitly allowed.

```js
const TRANSITIONS = {
  trialing: {
    trial_converted: "active",
    trial_ended_no_payment_method: "past_due",
    canceled_by_customer: "canceled",
  },
  active: {
    renewal_payment_failed: "past_due",
    canceled_by_customer: "canceled",
  },
  past_due: {
    retry_payment_succeeded: "active",
    retries_exhausted: "unpaid",
    canceled_by_customer: "canceled",
  },
  unpaid: {
    late_payment_succeeded: "active",
    canceled_by_customer: "canceled",
  },
  canceled: {},
};

function transition(subscription, event) {
  const allowed = TRANSITIONS[subscription.status];
  if (!allowed || !(event in allowed)) {
    throw new Error(
      `Invalid transition: cannot apply event "${event}" while status is "${subscription.status}"`
    );
  }
  const nextStatus = allowed[event];
  return {
    ...subscription,
    status: nextStatus,
    history: [...subscription.history, { event, from: subscription.status, to: nextStatus }],
  };
}

function newSubscription(id) {
  return { id, status: "trialing", history: [] };
}
```

Running a subscription through trial conversion, a failed renewal, a successful retry, then cancellation:

```js
let sub = newSubscription("sub_mock_1");
console.log("Start:", sub.status);
sub = transition(sub, "trial_converted");
console.log("After trial_converted:", sub.status);
sub = transition(sub, "renewal_payment_failed");
console.log("After renewal_payment_failed:", sub.status);
sub = transition(sub, "retry_payment_succeeded");
console.log("After retry_payment_succeeded:", sub.status);
sub = transition(sub, "canceled_by_customer");
console.log("After canceled_by_customer:", sub.status);
console.log("\nFull history for sub_mock_1:");
console.log(sub.history);

console.log("\nAttempting to transition a canceled subscription:");
try {
  transition(sub, "renewal_payment_failed");
} catch (err) {
  console.log("Caught expected error:", err.message);
}
```

Actual output from running this with `node`:

```text
Start: trialing
After trial_converted: active
After renewal_payment_failed: past_due
After retry_payment_succeeded: active
After canceled_by_customer: canceled

Full history for sub_mock_1:
[
  { event: 'trial_converted', from: 'trialing', to: 'active' },
  { event: 'renewal_payment_failed', from: 'active', to: 'past_due' },
  { event: 'retry_payment_succeeded', from: 'past_due', to: 'active' },
  { event: 'canceled_by_customer', from: 'active', to: 'canceled' }
]

Attempting to transition a canceled subscription:
Caught expected error: Invalid transition: cannot apply event "renewal_payment_failed" while status is "canceled"
```

Notice the final line: `canceled` has no entries in `TRANSITIONS`, so any event applied to it throws — this is the code enforcing that cancellation is terminal, exactly as the state diagram in section 1 shows.

## Comparison

| Concept | Stripe | Razorpay | PayPal |
|---|---|---|---|
| Recurring billing resource | Subscription object | Subscription resource | Subscription resource (created against a Billing Plan) |
| Trial state | Status conceptually equivalent to `trialing` | Modeled via the subscription's trial configuration and status | Modeled via the plan's trial billing cycle configuration |
| Successfully billing state | Status conceptually equivalent to `active` | Status conceptually equivalent to active | Status conceptually equivalent to active |
| Failed-but-retriable state | Status conceptually equivalent to `past_due` | Status reflecting a failed/retriable charge | Status conceptually equivalent to suspended-pending-retry |
| Terminal state | `canceled` (and, depending on configuration, a distinct unpaid-style status before full cancellation) | A canceled/terminal status reached after retries are exhausted or on explicit cancellation | `canceled` (or a suspended state that requires reactivation, depending on configuration) |
| Exact field/status names | Verify against current Stripe docs | Verify against current Razorpay docs | Verify against current PayPal docs |

## Common Mistakes

- Assuming the `trialing → active` webhook always means the first payment succeeded — a trial can also end because the customer never added a valid payment method, which routes into a failure/retry state instead, not straight into `active`.
- Treating `past_due` as equivalent to `canceled` — a `past_due` subscription is still alive and retriable (the customer may still have access, by design, while a retry is attempted); `canceled` is terminal. Revoking access the moment a renewal fails, instead of waiting for the terminal event, punishes customers whose card simply needs updating.
- Hardcoding one provider's exact status string throughout business logic, instead of mapping incoming statuses onto your own small internal enum (e.g. `TRIALING`, `ACTIVE`, `PAST_DUE`, `CANCELED`) — this makes supporting a second provider, or a provider renaming/adding statuses, far more expensive than it needs to be.
- Not handling out-of-order webhook delivery — because retries and renewals happen on a schedule with no user present, it's possible for a "renewal failed" event for an old billing cycle to arrive after a "renewal succeeded" event for a newer one; a handler that blindly applies whatever event arrives last can move a healthy subscription back into `past_due`.
- Building a subscription model with only two states (paid/unpaid) and bolting retry logic on top later, instead of designing the state machine with `past_due` as a first-class state from the start.

## Hands-On Exercises

1. **Run the transition function as shown.** Save the `TRANSITIONS` object, `transition`, `newSubscription`, and the demo code from section 4 into one file and run it with `node`. Confirm your output matches what's shown above, including the thrown error at the end.
2. **Run the "trial never converts, exhausts retries, later recovers" path.** Add this to the same file:

   ```js
   let sub2 = newSubscription("sub_mock_2");
   console.log("Start:", sub2.status);
   sub2 = transition(sub2, "trial_ended_no_payment_method");
   console.log("After trial_ended_no_payment_method:", sub2.status);
   sub2 = transition(sub2, "retries_exhausted");
   console.log("After retries_exhausted:", sub2.status);
   sub2 = transition(sub2, "late_payment_succeeded");
   console.log("After late_payment_succeeded:", sub2.status);
   console.log("Full history for sub_mock_2:");
   console.log(sub2.history);
   ```

   Run it with `node` and confirm the actual output:

   ```text
   Start: trialing
   After trial_ended_no_payment_method: past_due
   After retries_exhausted: unpaid
   After late_payment_succeeded: active
   Full history for sub_mock_2:
   [
     {
       event: 'trial_ended_no_payment_method',
       from: 'trialing',
       to: 'past_due'
     },
     { event: 'retries_exhausted', from: 'past_due', to: 'unpaid' },
     { event: 'late_payment_succeeded', from: 'unpaid', to: 'active' }
   ]
   ```

   Trace it: the subscription never touched `active` until the very last line, even though it was "trialing" first — confirming a trial that never converts is not the same as an active subscription that later fails.
3. **Add a missing transition on purpose.** Delete the `retry_payment_succeeded` entry from `past_due` in `TRANSITIONS`, then rerun demo 1 from exercise 1. Confirm it now throws at the `retry_payment_succeeded` step instead of succeeding, and read the error message to confirm it correctly names the invalid event and the current state.
4. **Extend the state machine with a grace-period state.** Add a new state, `grace_period`, reachable from `past_due` via a `grace_period_started` event, with its own further transitions to either `active` (via `retry_payment_succeeded`) or `canceled` (via `grace_period_expired`). Update `newSubscription`'s comment (or a code comment) to note where this sits relative to Lesson 3's dunning strategy.
5. **Map this lesson's internal state names onto a real provider.** Pick one provider (Stripe, Razorpay, or PayPal) and open its subscription/billing docs. Write down, in your own notes, which of its actual status values correspond to this lesson's `trialing`, `active`, `past_due`, and terminal states — and flag anywhere the mapping isn't a clean 1:1, since some providers split what this lesson treats as one state into two.

## Interview Q&A

**Q: Why is `past_due` a distinct state instead of just treating the subscription as unpaid/inactive?**
A: Because a `past_due` subscription is still alive and retriable — the charge failed but the provider (and often the app) will try again, and many products intentionally keep access on during this window. Collapsing it into "inactive" causes premature access revocation for a customer whose card may simply need updating.

**Q: If a subscription's trial ends, does that always mean the first payment succeeded?**
A: No — a trial can end because no valid payment method is on file, which routes the subscription into a failure/retry state instead of `active`. The `trialing → active` webhook should only be trusted for subscriptions where the corresponding "first charge succeeded" event actually fired.

**Q: What's the practical difference between `past_due` and `canceled`?**
A: `past_due` is a temporary, retriable state — the subscription can recover back to `active`. `canceled` is terminal — no further event moves it anywhere. Business logic that treats these the same either revokes access too early (if it treats `past_due` as `canceled`) or never revokes access at all (if it treats `canceled` as still-retriable).

**Q: Do Stripe, Razorpay, and PayPal subscriptions all move through fundamentally different lifecycles?**
A: No — conceptually all three converge on the same trial → active → failed-and-retriable → terminal shape, just under different object names and status strings. The exact field/status names differ per provider and should be verified against current docs rather than assumed.

**Q: Why should a webhook handler dedupe subscription lifecycle events by event ID, same as Phase 2's payment webhooks?**
A: Because providers deliver subscription webhooks under the same at-least-once guarantee as payment webhooks — a renewal-failed event can be redelivered, and without dedup by event ID a handler could apply the same transition twice or log duplicate notifications for what is really a single failure.
