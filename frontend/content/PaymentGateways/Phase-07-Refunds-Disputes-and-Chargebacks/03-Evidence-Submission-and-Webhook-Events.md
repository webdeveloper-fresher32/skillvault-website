# Evidence Submission and Webhook Events

Winning a dispute is mostly a documentation exercise: prove to the provider (who then represents the case to the card network) that the transaction was legitimate. But before evidence even matters, your application needs to know a dispute exists, track where it stands, and — critically — notice when it's over. That last part is where Phase 2's webhook model comes back in full force: the same "webhook is the authority, not your synchronous assumptions" lesson, applied to a multi-step state machine instead of a single success/fail event.

## 1. What Counts as Evidence

Evidence in a dispute response is whatever documentation supports that the charge was legitimate and the customer's claim doesn't hold up. Common categories across providers:

| Evidence type | What it demonstrates |
|---|---|
| Proof of delivery/fulfillment | The customer received what they paid for (tracking numbers, delivery confirmation, access logs for digital goods) |
| Customer communication | Emails/chat logs showing the customer's own statements about the order, especially anything contradicting the dispute reason given |
| Terms-of-service acceptance | The customer agreed to the terms governing the transaction (refund policy, subscription terms, cancellation rules) at the time of purchase |
| Receipt/invoice details | Confirmation the charged amount matches what was actually agreed to and delivered |
| Prior refund history | Whether the merchant already voluntarily refunded this charge, which is directly relevant if the dispute reason overlaps with something already resolved |

Which specific evidence types are decisive for a given case depends on the dispute reason code the customer's bank assigned (e.g. "product not received" vs. "unauthorized transaction" call for different evidence) — reason codes and their exact category names are provider/card-network-specific and not asserted here in detail.

## 2. Submitting Evidence Programmatically vs. via Dashboard

Providers generally offer two paths for responding to a dispute: through their web dashboard (manually uploading documents and filling in a form) or programmatically through an API call that attaches evidence fields to the dispute record. Which path fits depends on the scale of the operation — a business handling a handful of disputes a month can reasonably work entirely from the dashboard, while a business handling disputes at volume benefits from automating evidence assembly (pulling delivery confirmation and communication logs from its own systems) and submitting it via API. Exact endpoint names, required field names, and file-upload mechanics are provider-specific and change over time — don't treat any specific endpoint name as fact without checking that provider's current API reference; what's safe to assert is that both a dashboard path and a programmatic path generally exist, and the underlying evidence categories from section 1 are what both paths ultimately collect.

## 3. Dispute Webhook Events and State Tracking (Phase 2's Model, Applied)

Phase 2 established that a webhook is the authoritative signal for what actually happened, because it comes server-to-server from the provider's own system of record rather than depending on something in your control staying alive or your assumptions holding. A dispute is where that model matters most, because it's not a single event — it's a sequence, and an application that only handles the *first* event in that sequence ends up with internal state that's permanently wrong.

Phase 3's Stripe event table already verified `charge.dispute.created` as a real, concrete event name — the one that opens a dispute. The events that follow (evidence acknowledged, dispute closed with a won/lost outcome) exist conceptually across providers in the same shape, but this lesson does not assert specific event-name strings beyond `charge.dispute.created` as verified fact — check a given provider's current webhook event list before wiring production logic against exact names.

The state machine an app needs, generalized from Phase 2's model:

```text
(no dispute)
      |
      v   charge.dispute.created  <-- verified Stripe event name (Phase 3)
 needs_response
      |
      v   evidence submitted (app-driven action, or a provider event
      |    acknowledging receipt - verify exact event name per provider)
 under_review
      |
      v   dispute closed, with an outcome of won or lost
      |    (verify exact event name per provider)
      +--> won   (terminal)
      +--> lost  (terminal)
```

## 4. Example: Dispute State Tracker Driven by Webhook Events

The function below models exactly this state machine, transitioning purely in response to incoming event names (and, for the terminal "closed" event, an outcome field) — the same shape a real webhook handler would drive, just without the HTTP/signature-verification plumbing Phase 2 and Phase 3 already covered.

```js
function makeDisputeTracker() {
  let state = null;
  const history = [];

  // Illustrative event-type strings. "charge.dispute.created" is the one
  // concrete Stripe event name this course has already verified (Phase 3's
  // event table). "evidence_submitted" and "charge.dispute.closed" here
  // model the generic shape of a dispute lifecycle described in section 3 -
  // check a given provider's current docs for its actual closed/won/lost
  // event naming before wiring this against a live account.
  const TRANSITIONS = {
    null: { "charge.dispute.created": "needs_response" },
    needs_response: {
      evidence_submitted: "under_review",
      "charge.dispute.closed": "TERMINAL",
    },
    under_review: {
      "charge.dispute.closed": "TERMINAL",
    },
    won: {},
    lost: {},
  };

  function applyEvent(eventType, payload) {
    const fromState = state;
    const table = TRANSITIONS[String(fromState)] || {};
    const target = table[eventType];

    if (!target) {
      console.log(`[dispute] Event "${eventType}" ignored - no transition defined from state "${fromState}"`);
      return state;
    }

    let nextState = target;
    if (target === "TERMINAL") {
      if (!payload || (payload.outcome !== "won" && payload.outcome !== "lost")) {
        console.log(`[dispute] Event "${eventType}" ignored - closed event missing a valid outcome ("won"/"lost")`);
        return state;
      }
      nextState = payload.outcome;
    }

    state = nextState;
    history.push(state);
    console.log(`[dispute] Event "${eventType}"${payload ? ` (${JSON.stringify(payload)})` : ""} -> state "${fromState}" => "${nextState}"`);
    return state;
  }

  return { applyEvent, getState: () => state, getHistory: () => history.slice() };
}

console.log("=== Sequence 1: full WON lifecycle ===");
const wonTracker = makeDisputeTracker();
wonTracker.applyEvent("charge.dispute.created");
wonTracker.applyEvent("evidence_submitted");
wonTracker.applyEvent("charge.dispute.closed", { outcome: "won" });
console.log("Final state (won sequence):", wonTracker.getState());
console.log("History (won sequence):", wonTracker.getHistory());

console.log("\n=== Sequence 2: full LOST lifecycle ===");
const lostTracker = makeDisputeTracker();
lostTracker.applyEvent("charge.dispute.created");
lostTracker.applyEvent("evidence_submitted");
lostTracker.applyEvent("charge.dispute.closed", { outcome: "lost" });
console.log("Final state (lost sequence):", lostTracker.getState());
console.log("History (lost sequence):", lostTracker.getHistory());
```

Actual output from running this with `node`:

```text
=== Sequence 1: full WON lifecycle ===
[dispute] Event "charge.dispute.created" -> state "null" => "needs_response"
[dispute] Event "evidence_submitted" -> state "needs_response" => "under_review"
[dispute] Event "charge.dispute.closed" ({"outcome":"won"}) -> state "under_review" => "won"
Final state (won sequence): won
History (won sequence): [ 'needs_response', 'under_review', 'won' ]

=== Sequence 2: full LOST lifecycle ===
[dispute] Event "charge.dispute.created" -> state "null" => "needs_response"
[dispute] Event "evidence_submitted" -> state "needs_response" => "under_review"
[dispute] Event "charge.dispute.closed" ({"outcome":"lost"}) -> state "under_review" => "lost"
Final state (lost sequence): lost
History (lost sequence): [ 'needs_response', 'under_review', 'lost' ]
```

Both sequences correctly reach their respective terminal states, and each `history` array shows the full path the tracker walked through in order — `needs_response` → `under_review` → the terminal outcome. Feeding the tracker an unrecognized event, or a `charge.dispute.closed` event once it's already in a terminal state, logs an "ignored" message and leaves `state` unchanged rather than corrupting it, which is exactly the behavior a real webhook handler needs when it receives a redelivered or out-of-order event (Phase 2, Lesson 3's idempotency point, applied here too).

## Comparison

| Aspect | Phase 2's general webhook-authority model | Applied to dispute state tracking (this lesson) |
|---|---|---|
| What triggers a state change | Any webhook event in general (payment succeeded/failed/refunded/disputed) | Specifically the dispute-lifecycle events: created, evidence acknowledged, closed with an outcome |
| Why the webhook is authoritative | It's sent server-to-server from the provider's system of record, independent of the browser/client | Same reason — the dispute's real status lives on the provider's side, driven by the card network, not by anything your app can observe directly |
| Risk of only handling one event type | Treating "any webhook hit my endpoint" as "payment succeeded" mishandles failures/refunds/disputes (Phase 2, Lesson 1) | Only handling `charge.dispute.created` and never the terminal closed event leaves internal state stuck at `needs_response` forever, even after the case has actually resolved |
| Idempotency concern | Redelivered events must not double-process (Phase 2, Lesson 3) | A redelivered or out-of-order event (e.g. a second `charge.dispute.closed`) must not corrupt an already-terminal state — the tracker above simply ignores transitions with no defined target |

## Common Mistakes

- Only tracking the "dispute created" event and not the terminal "dispute closed (won/lost)" event, leaving the app's internal state stuck at `needs_response` forever — the dispute resolves on the provider's side regardless of whether your app noticed, so a missing terminal-event handler produces a permanently stale status that no longer reflects reality.
- Not automatically flagging orders under dispute in customer-facing UI or internal support tools — a support agent looking at an order with no visible "disputed" indicator might issue a duplicate refund on top of a dispute that's already in progress, or reassure a customer about an order that's actually contested.
- Assuming evidence submitted via the dashboard automatically updates whatever internal tracking system your app maintains — if a human submits evidence through the provider's dashboard directly, your app's own state tracker only finds out via the corresponding webhook event, not by osmosis; the tracking model still depends entirely on webhooks arriving and being processed.
- Inventing or assuming specific webhook event-name strings for the "evidence acknowledged" or "closed" steps without checking a given provider's current docs — only `charge.dispute.created` has been verified as an exact, concrete name in this course (Phase 3); the shape of the lifecycle generalizes across providers, but exact event-name strings do not.
- Treating a `charge.dispute.closed`-equivalent event with a "won" outcome as the end of the story with no further bookkeeping — a won dispute still needs to be reconciled with the original order status (e.g. reverting a "disputed" flag back to "paid," not leaving it in limbo).

## Hands-On Exercises

1. **Run the dispute-state-tracking function through a full WON sequence.** Save `makeDisputeTracker` and the "Sequence 1" demo from section 4 into one file and run it with `node`. Confirm the final state is `won` and the history array shows `['needs_response', 'under_review', 'won']`, matching the output shown above.
2. **Run it through a full LOST sequence.** Add the "Sequence 2" demo to the same file, run it with `node`, and confirm the final state is `lost` with history `['needs_response', 'under_review', 'lost']`.
3. **Feed it an out-of-order event.** Create a fresh tracker, call `applyEvent("evidence_submitted")` as the very first call (before `charge.dispute.created`), and confirm it's ignored (state stays `null`) since no transition is defined from `null` for that event type. Run it with `node` and check the actual logged output.
4. **Feed it a closed event with no outcome.** Create a fresh tracker, apply `charge.dispute.created` then `charge.dispute.closed` with no `payload` argument at all. Confirm the closed event is ignored (state stays `needs_response`) since the tracker requires a valid `won`/`lost` outcome to complete the terminal transition. Run it with `node` and check the actual logged output.
5. **Paper exercise: wire it into the schema from Lesson 2.** Using the `orders` table sketch from Lesson 2's Exercise 2 (with `disputed`, `dispute_won`, `dispute_lost` states), write out which of this lesson's tracker states (`needs_response`, `under_review`, `won`, `lost`) should map to which order-table status, and at which exact transition your webhook handler should fire a customer-facing notification versus an internal support/finance notification.

## Interview Q&A

**Q: What are the three broad categories of evidence typically submitted in a dispute response?**
A: Proof of delivery/fulfillment, customer communication records, and proof of terms-of-service acceptance — plus receipt/invoice details and prior refund history where relevant. Which ones are decisive depends on the specific dispute reason code assigned by the customer's bank.

**Q: Why is only handling the "dispute created" webhook event not enough?**
A: Because the dispute doesn't end there — it later resolves as won or lost on the provider's side. If the app never handles the terminal "closed" event, its internal state stays at "needs response" indefinitely, even though the real case has already concluded, leaving the app's records permanently out of sync with reality.

**Q: How does dispute-state tracking relate to Phase 2's webhook-authority model?**
A: It's the same principle extended to a multi-step sequence instead of a single event: the provider's webhooks are the authoritative source of truth for the dispute's real status, because they come server-to-server from the provider's own system of record. The app's job is to transition its internal state strictly in response to those events, not to assume progress based on anything happening in its own UI or dashboard actions taken outside its own system.

**Q: If a human submits evidence directly through the provider's dashboard instead of through your app, does your app's internal dispute tracker know about it?**
A: Only if it receives and processes the corresponding webhook event — dashboard actions don't update your app's internal state by themselves. The tracking model depends entirely on webhook events arriving and being handled, exactly like every other event-driven state in this course.

**Q: Why does the dispute-state tracker in this lesson ignore a `charge.dispute.closed` event received while already in a terminal state, instead of processing it again?**
A: Because a redelivered or duplicate closed event should not be allowed to re-run or corrupt a state that's already resolved — this mirrors Phase 2's idempotency lesson: a handler needs to treat events it's already acted on (or that don't apply to its current state) as no-ops rather than re-processing them.
