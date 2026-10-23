# Project 2 — Subscription Billing System with Dunning

**Phase combined:** Phase 6 (Recurring Payments and Subscriptions — Lesson 1's state machine, Lesson 3's dunning backoff schedule)

## Problem Statement

Phase 6 taught the subscription lifecycle state machine (Lesson 1) and the dunning backoff schedule (Lesson 3) as two separate lessons, each with its own runnable example. In a real billing system, they're not separate — a failed renewal moves the subscription into `past_due` *and* triggers a computed retry schedule, and the outcome of that retry schedule (resolved or exhausted) is what decides the subscription's next transition. Neither piece is useful in isolation: a state machine with no retry schedule can't decide *when* to try again, and a retry schedule that never feeds back into subscription state can't decide when to actually cancel.

This project wires the two together into one system and traces a single subscription through its full lifecycle: `trialing` → `active` → a failed renewal → dunning retries → an app-level grace period → eventual cancellation.

## Approach Discussion

The combined system keeps both pieces exactly as Phase 6 defined them — same state names (`trialing`, `active`, `past_due`, `unpaid`, `canceled`), same transition function shape, same `computeRetrySchedule(failureDate, offsetDaysList)` signature — because inventing new names here would break the whole point of having learned the state machine already. The one addition is the `grace_period` state that Phase 6 Lesson 1's Exercise 4 asked you to design on paper: reachable from `past_due` via a `grace_period_started` event, with its own transitions onward to `active` (a late retry succeeds) or `canceled` (the grace period expires with no payment). This project actually wires that exercise into the runnable transition table instead of leaving it as a paper exercise.

The trace deliberately takes the "nothing recovers" branch rather than the "retry succeeds" branch already demonstrated in Phase 6 Lesson 1's own exercises, because the more interesting integration point is dunning's role *between* `past_due` and the eventual terminal state: the retry schedule is computed once a renewal fails, each computed retry date is simulated as also failing, and only then does the subscription move into (and out of) the app-level grace period Phase 6 Lesson 3 described as the more humane alternative to hard-canceling the instant the provider's own retries are exhausted.

## Solution

```js
// subscription-dunning.js
// SELF-CONTAINED — no live credentials, no network calls. Combines Phase 6
// Lesson 1's subscription state machine (TRANSITIONS / transition / newSubscription)
// with Phase 6 Lesson 3's dunning backoff schedule (computeRetrySchedule) into one
// end-to-end trace: trial -> active -> a failed renewal -> dunning retries ->
// eventual cancellation.

// --- Phase 6 Lesson 1: subscription state machine (reused as-is, same state names) ---
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
    grace_period_started: "grace_period", // extension per Phase 6 Lesson 1 Exercise 4
  },
  grace_period: {
    retry_payment_succeeded: "active",
    grace_period_expired: "canceled",
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

// --- Phase 6 Lesson 3: dunning backoff schedule (reused as-is) ---
function computeRetrySchedule(failureDate, offsetDaysList) {
  const failure = new Date(failureDate);
  if (Number.isNaN(failure.getTime())) {
    throw new Error(`Invalid failureDate: ${failureDate}`);
  }
  return offsetDaysList.map((offsetDays) => {
    const retryDate = new Date(failure);
    retryDate.setUTCDate(retryDate.getUTCDate() + offsetDays);
    return { offsetDays, retryDate: retryDate.toISOString().slice(0, 10) };
  });
}

// Illustrative retry offsets for THIS trace only — not any provider's actual
// default cadence (Phase 6 Lesson 3's hedge applies here unchanged).
const RETRY_OFFSETS = [1, 3, 7];

// --- The combined trace: trial -> active -> failed renewal -> dunning -> cancellation ---

let sub = newSubscription("sub_mock_e2e_1");
console.log("Start:", sub.status);

sub = transition(sub, "trial_converted");
console.log("After trial_converted:", sub.status);

// A renewal fails. This is where Phase 6 Lesson 3's dunning flow begins.
const failureDate = "2026-08-01";
sub = transition(sub, "renewal_payment_failed");
console.log("After renewal_payment_failed:", sub.status);

const schedule = computeRetrySchedule(failureDate, RETRY_OFFSETS);
console.log("\nDunning retry schedule computed for failure on", failureDate + ":");
console.log(schedule);

// Retries run on the schedule above. In this trace, none of the provider's
// automatic retries succeed (a realistic branch Phase 6 Lesson 3 calls out:
// dunning exists precisely because not every failure resolves itself).
console.log("\nSimulating retry attempts on the computed schedule:");
for (const attempt of schedule) {
  console.log(`  Retry attempt on ${attempt.retryDate} (offset +${attempt.offsetDays}d) -> still declined`);
}

// The provider's "retries exhausted" webhook fires here (Phase 6 Lesson 3,
// section 3). Rather than moving straight to a terminal `unpaid`/`canceled`
// status, the app starts its own grace period (the Phase 6 Lesson 1, Exercise 4
// extension to the state machine) as one final, clearly communicated window
// before hard-canceling.
console.log("\nProvider's 'retries exhausted' webhook fires -> app starts a grace period instead of hard-canceling immediately.");
sub = transition(sub, "grace_period_started");
console.log("After grace_period_started:", sub.status);

// The customer never updates their payment method before the grace period ends.
sub = transition(sub, "grace_period_expired");
console.log("After grace_period_expired:", sub.status);

console.log("\nFull history for sub_mock_e2e_1:");
console.log(sub.history);

console.log("\nAttempting to transition the now-canceled subscription (expected to throw):");
try {
  transition(sub, "retry_payment_succeeded");
} catch (err) {
  console.log("Caught expected error:", err.message);
}
```

Actual output from running this with `node`:

```text
Start: trialing
After trial_converted: active
After renewal_payment_failed: past_due

Dunning retry schedule computed for failure on 2026-08-01:
[
  { offsetDays: 1, retryDate: '2026-08-02' },
  { offsetDays: 3, retryDate: '2026-08-04' },
  { offsetDays: 7, retryDate: '2026-08-08' }
]

Simulating retry attempts on the computed schedule:
  Retry attempt on 2026-08-02 (offset +1d) -> still declined
  Retry attempt on 2026-08-04 (offset +3d) -> still declined
  Retry attempt on 2026-08-08 (offset +7d) -> still declined

Provider's 'retries exhausted' webhook fires -> app starts a grace period instead of hard-canceling immediately.
After grace_period_started: grace_period
After grace_period_expired: canceled

Full history for sub_mock_e2e_1:
[
  { event: 'trial_converted', from: 'trialing', to: 'active' },
  { event: 'renewal_payment_failed', from: 'active', to: 'past_due' },
  {
    event: 'grace_period_started',
    from: 'past_due',
    to: 'grace_period'
  },
  {
    event: 'grace_period_expired',
    from: 'grace_period',
    to: 'canceled'
  }
]

Attempting to transition the now-canceled subscription (expected to throw):
Caught expected error: Invalid transition: cannot apply event "retry_payment_succeeded" while status is "canceled"
```

Trace through the history array: the subscription never touches `unpaid` in this run — it goes `active → past_due → grace_period → canceled`, because this trace models the app choosing to start a grace period directly off `past_due` once the computed retry schedule is exhausted, rather than passing through a separate provider-side `unpaid` status first. `unpaid` remains a valid destination in `TRANSITIONS` (reachable via `retries_exhausted`, as Phase 6 Lesson 1 defined it) for providers/configurations that model it that way — this trace simply demonstrates the grace-period branch instead, since that's the one this project is built to exercise. The final thrown error confirms `canceled` is still terminal exactly as Phase 6 Lesson 1 established, even with the new `grace_period` state added to the table.

## Trade-offs and Considerations

**When to give up retrying vs. keep trying** is fundamentally a bet about *why* a charge failed, and Phase 6 Lesson 3 was explicit that you can't tell which kind of failure you're looking at from the decline alone. A short, fixed retry schedule (like the illustrative 1/3/7-day offsets used here) is a reasonable default because it catches the common transient cases — a temporarily low balance, a bank's fraud system flagging an unattended charge — within about a week, without dragging out a genuinely dead card (permanently expired, account closed) for so long that the customer forgets they're even mid-renewal. The trade-off is real: retry too few times and you cancel customers whose card would have resolved itself in another day or two; retry too many times (or too aggressively, with tight spacing) and issuing banks can flag your account for unusual-looking repeated authorization attempts, which is its own operational risk separate from the individual subscription's fate. There's no universally correct number of attempts — it should be tuned against your own customer base's actual failure-reason distribution, not copied from a blog post or, for that matter, from this project's illustrative offsets.

**Grace-period UX considerations** matter as much as the retry count itself. A grace period only helps churn if the customer actually knows they're in one — silently keeping access on while quietly retrying in the background gives them no reason to act, and the eventual hard cancellation then feels sudden even though, mechanically, it wasn't. The grace period needs its own clear, dated communication ("your access ends on August 15th unless you update your card"), separate from whatever the provider's own retry-webhook notifications say, precisely because Phase 6 Lesson 3 pointed out that provider retries are silent to the customer by default. There's also a subtler trade-off in *what the customer can still do* during the grace period: full access (as this trace assumes) maximizes the chance they notice something's wrong through normal use, but it also delays the moment they're forced to deal with the problem; a reduced-access "please fix your payment method" state forces the issue faster but risks feeling punitive for what might still be a transient bank-side hiccup. Neither choice is free, and the right one depends on how much you're willing to trade a slightly worse experience for a faster resolution rate — a decision to make deliberately per product, not by default.
