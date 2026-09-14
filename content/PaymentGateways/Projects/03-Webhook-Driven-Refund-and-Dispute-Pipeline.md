# Project 3 — Webhook-Driven Refund and Dispute Pipeline

**Phases combined:** Phase 2 (Webhooks and Event Processing — Lesson 3's idempotent-handler pattern), Phase 7 (Refunds, Disputes, and Chargebacks — Lesson 1's refund tracking, Lesson 3's dispute state tracking)

## Problem Statement

Phase 2 taught that webhook delivery is at-least-once, not exactly-once, and that a handler has to dedup by event ID before doing any real work (Lesson 3). Phase 7 separately built two pieces of state-tracking logic that live *inside* "the real work" a webhook handler does: a cumulative refund tracker (Lesson 1) that rejects over-refunds, and a dispute state tracker (Lesson 3) that moves through `needs_response → under_review → won/lost` strictly in response to incoming events.

Neither Phase 7 example was ever wrapped in the idempotency layer Phase 2 requires — they were demonstrated as standalone state machines, fed events directly, with no mention of what happens if the same event arrives twice. But refund and dispute events are ordinary webhooks, subject to the exact same at-least-once delivery guarantee as everything else Phase 2 covered. A refund event redelivered without dedup would double-count the refund against the same charge; a dispute-closed event redelivered without dedup risks re-applying (or corrupting) an already-terminal outcome. This project builds the pipeline that should have wrapped both trackers from the start: one idempotent dispatcher, routing deduped events to whichever Phase 7 tracker matches the event category.

## Approach Discussion

The pipeline keeps a `processedEventIds` set exactly as Phase 2 Lesson 3's `makeHandler` did, and it runs the dedup check first, before any routing or tracker logic — the same "verify → dedup → do the work" ordering from that lesson's flow diagram (this project skips signature verification itself, since Phase 2 Lesson 2 already covers that step in isolation and it doesn't interact with the idempotency or tracking logic being combined here). Only once an event ID is confirmed new does the pipeline look at its `type` and route it to a refund tracker or a dispute tracker, keyed by charge ID — so refunds and disputes against different charges don't share state, and a charge with both a refund and a later dispute keeps one tracker of each kind rather than one tangled tracker doing both jobs.

Both Phase 7 trackers are reused with their exact function shapes (`makeRefundTracker(originalAmount)` returning `requestRefund`/`getTotalRefunded`; `makeDisputeTracker()` returning `applyEvent`/`getState`/`getHistory`) — the pipeline's job is purely to decide *whether* an event reaches a tracker at all (the dedup check) and *which* tracker it reaches (routing by event type), not to reimplement either tracker's internal logic.

To prove the dedup actually matters and isn't just decorative, the driving event sequence deliberately redelivers one event — `evt_r1`, a `$30.00` refund — a second time in the middle of the sequence, interleaved with dispute events for the same charge. A correct pipeline processes the refund once, applies both dispute-lifecycle events, and silently skips the redelivered refund with no change to the refund total.

## Solution

```js
// webhook-pipeline.js
// SELF-CONTAINED — no live credentials, no network calls, no HTTP/signature
// plumbing (Phase 2 Lesson 2 already covers signature verification in isolation).
// Combines Phase 2 Lesson 3's idempotent-handler dedup-by-event-ID pattern with
// Phase 7's refund cumulative-tracking (Lesson 1) and dispute state tracker
// (Lesson 3) into one webhook processing pipeline, fed a sequence of mock events
// including a duplicate delivery.

// --- Phase 7 Lesson 1: cumulative refund tracker (reused as-is) ---
function makeRefundTracker(originalAmount) {
  let totalRefunded = 0;
  function requestRefund(amount) {
    if (amount <= 0) {
      return { ok: false, reason: "Refund amount must be positive" };
    }
    if (totalRefunded + amount > originalAmount) {
      return {
        ok: false,
        reason: `Refund of ${amount} would exceed original charge of ${originalAmount} (already refunded ${totalRefunded}, only ${originalAmount - totalRefunded} refundable)`,
      };
    }
    totalRefunded += amount;
    return { ok: true, refunded: amount, totalRefunded, remaining: originalAmount - totalRefunded };
  }
  return { requestRefund, getTotalRefunded: () => totalRefunded };
}

// --- Phase 7 Lesson 3: dispute state tracker (reused as-is) ---
function makeDisputeTracker() {
  let state = null;
  const history = [];
  const TRANSITIONS = {
    null: { "charge.dispute.created": "needs_response" },
    needs_response: {
      evidence_submitted: "under_review",
      "charge.dispute.closed": "TERMINAL",
    },
    under_review: { "charge.dispute.closed": "TERMINAL" },
    won: {},
    lost: {},
  };
  function applyEvent(eventType, payload) {
    const fromState = state;
    const table = TRANSITIONS[String(fromState)] || {};
    const target = table[eventType];
    if (!target) {
      return { changed: false, state };
    }
    let nextState = target;
    if (target === "TERMINAL") {
      if (!payload || (payload.outcome !== "won" && payload.outcome !== "lost")) {
        return { changed: false, state };
      }
      nextState = payload.outcome;
    }
    state = nextState;
    history.push(state);
    return { changed: true, state };
  }
  return { applyEvent, getState: () => state, getHistory: () => history.slice() };
}

// --- Phase 2 Lesson 3: idempotent dispatcher wrapping the above (dedup by event ID) ---
// Per-charge state lives in a plain object keyed by charge ID, standing in for a
// database table in a real system (see Trade-offs in the project write-up).
function makePipeline() {
  const processedEventIds = new Set();
  const refundTrackersByCharge = {}; // chargeId -> refund tracker
  const disputeTrackersByCharge = {}; // chargeId -> dispute tracker
  const log = [];

  function getRefundTracker(chargeId, originalAmount) {
    if (!refundTrackersByCharge[chargeId]) {
      refundTrackersByCharge[chargeId] = makeRefundTracker(originalAmount);
    }
    return refundTrackersByCharge[chargeId];
  }

  function getDisputeTracker(chargeId) {
    if (!disputeTrackersByCharge[chargeId]) {
      disputeTrackersByCharge[chargeId] = makeDisputeTracker();
    }
    return disputeTrackersByCharge[chargeId];
  }

  function handleWebhookEvent(event) {
    // Step 1: dedup by event ID (Phase 2 Lesson 3) — runs before any business
    // logic, exactly as the "verify signature -> dedup -> record -> work" shape
    // from that lesson's flow diagram (signature verification itself is out of
    // scope here; Phase 2 Lesson 2 covers it standalone).
    if (processedEventIds.has(event.id)) {
      const line = `[pipeline] Event ${event.id} (${event.type}) already processed - SKIPPING (idempotent, no double-processing)`;
      log.push(line);
      console.log(line);
      return { deduped: true };
    }
    processedEventIds.add(event.id);

    // Step 2: route to the Phase 7 tracker that matches the event category.
    let result;
    if (event.type === "charge.refunded") {
      const tracker = getRefundTracker(event.chargeId, event.originalAmount);
      const outcome = tracker.requestRefund(event.amount);
      result = { category: "refund", outcome, totalRefunded: tracker.getTotalRefunded() };
    } else if (event.type === "charge.dispute.created" || event.type === "evidence_submitted" || event.type === "charge.dispute.closed") {
      const tracker = getDisputeTracker(event.chargeId);
      const outcome = tracker.applyEvent(event.type, event.payload);
      result = { category: "dispute", outcome, disputeState: tracker.getState() };
    } else {
      result = { category: "unknown", note: `no handler registered for event type "${event.type}"` };
    }

    const line = `[pipeline] Event ${event.id} (${event.type}) is new - PROCESSED: ${JSON.stringify(result)}`;
    log.push(line);
    console.log(line);
    return { deduped: false, result };
  }

  return {
    handleWebhookEvent,
    getProcessedCount: () => processedEventIds.size,
    getRefundTracker,
    getDisputeTracker,
    getLog: () => log.slice(),
  };
}

// --- Drive the pipeline with a mock event sequence, including a duplicate delivery ---
const pipeline = makePipeline();
const CHARGE_ID = "ch_mock_78f3a1";
const ORIGINAL_AMOUNT = 10000; // e.g. $100.00 in cents

const events = [
  { id: "evt_r1", type: "charge.refunded", chargeId: CHARGE_ID, originalAmount: ORIGINAL_AMOUNT, amount: 3000 },
  { id: "evt_d1", type: "charge.dispute.created", chargeId: CHARGE_ID },
  { id: "evt_d2", type: "evidence_submitted", chargeId: CHARGE_ID },
  { id: "evt_r1", type: "charge.refunded", chargeId: CHARGE_ID, originalAmount: ORIGINAL_AMOUNT, amount: 3000 }, // REDELIVERY of evt_r1
  { id: "evt_d3", type: "charge.dispute.closed", chargeId: CHARGE_ID, payload: { outcome: "won" } },
];

console.log("=== Feeding webhook events through the pipeline (evt_r1 is delivered twice) ===\n");
for (const event of events) {
  pipeline.handleWebhookEvent(event);
}

console.log("\n=== Final state ===");
console.log("Distinct events processed:", pipeline.getProcessedCount(), "(5 events delivered, 1 was a duplicate)");
console.log("Refund tracker total refunded for", CHARGE_ID + ":", pipeline.getRefundTracker(CHARGE_ID, ORIGINAL_AMOUNT).getTotalRefunded());
console.log("Dispute tracker final state for", CHARGE_ID + ":", pipeline.getDisputeTracker(CHARGE_ID).getState());
console.log("Dispute tracker history:", pipeline.getDisputeTracker(CHARGE_ID).getHistory());
```

Actual output from running this with `node`:

```text
=== Feeding webhook events through the pipeline (evt_r1 is delivered twice) ===

[pipeline] Event evt_r1 (charge.refunded) is new - PROCESSED: {"category":"refund","outcome":{"ok":true,"refunded":3000,"totalRefunded":3000,"remaining":7000},"totalRefunded":3000}
[pipeline] Event evt_d1 (charge.dispute.created) is new - PROCESSED: {"category":"dispute","outcome":{"changed":true,"state":"needs_response"},"disputeState":"needs_response"}
[pipeline] Event evt_d2 (evidence_submitted) is new - PROCESSED: {"category":"dispute","outcome":{"changed":true,"state":"under_review"},"disputeState":"under_review"}
[pipeline] Event evt_r1 (charge.refunded) already processed - SKIPPING (idempotent, no double-processing)
[pipeline] Event evt_d3 (charge.dispute.closed) is new - PROCESSED: {"category":"dispute","outcome":{"changed":true,"state":"won"},"disputeState":"won"}

=== Final state ===
Distinct events processed: 4 (5 events delivered, 1 was a duplicate)
Refund tracker total refunded for ch_mock_78f3a1: 3000
Dispute tracker final state for ch_mock_78f3a1: won
Dispute tracker history: [ 'needs_response', 'under_review', 'won' ]
```

The line that matters most: the redelivered `evt_r1` is skipped outright (`already processed - SKIPPING`), and the refund tracker's final total is `3000`, not `6000` — proving the duplicate delivery never reached `requestRefund` a second time. Meanwhile the two dispute events sandwiched around the duplicate (`evt_d1`, `evt_d2`) and the closing event after it (`evt_d3`) all process normally, landing the dispute tracker in the terminal `won` state with the same `['needs_response', 'under_review', 'won']` history Phase 7 Lesson 3 produced standalone — confirming the idempotency wrapper doesn't interfere with events it hasn't seen before, only with the one it has.

## Trade-offs and Considerations

**Where the dedup-by-event-ID store lives in a real system** is the single biggest gap between this project's `processedEventIds` (an in-memory `Set`) and something safe to run in production — Phase 2 Lesson 3 flagged this explicitly, and it applies here unchanged. The two realistic options are a database table and a cache like Redis, and they fail differently:

- **A database table** (e.g. a `processed_webhook_events` table with the event ID as a unique/primary key) can be written in the *same transaction* as the actual state change — inserting the event ID and updating the refund tracker's row (or the dispute's status column) atomically. This closes the exact gap Phase 2 Lesson 3's Common Mistakes section warned about: recording the event ID only *after* the work finishes, so a crash between the two leaves the ID unrecorded and the work half-done on the next redelivery. Its failure mode is availability, not correctness: if the database is down, the webhook handler can't confirm dedup status at all, and has to fail the request (triggering a provider retry, which is safe) rather than risk processing without a dedup check.
- **A cache (e.g. Redis)** is faster and simpler to scale horizontally across many handler instances, but it doesn't naturally give you the same-transaction guarantee a database table does — recording "event ID processed" in Redis and updating the refund total in the database are two separate operations against two separate systems, which reopens exactly the crash-between-them gap a single-transaction database table closes. A cache-based dedup store also needs its own eviction/TTL policy; set the TTL too short and a very late redelivery (the provider retrying after an unusually long outage) could be treated as "new" again, silently reintroducing the double-processing bug the whole mechanism exists to prevent.

For a system where refund and dispute correctness genuinely matters financially (which describes both trackers in this project), a database table with the dedup check and the state update in the same transaction is the safer default; a cache is worth reaching for once request volume makes the extra database round-trip actually costly, and even then, treating it as a pure performance optimization layered in front of the transactional table (not a replacement for it) avoids reintroducing the crash-window gap.

**Keying trackers by charge ID, not globally, matters as the pipeline scales.** This project's `refundTrackersByCharge` and `disputeTrackersByCharge` are plain in-memory objects for the same reason `processedEventIds` is a plain `Set` — clarity for demonstrating the logic, not a production-ready store. In a real system, each charge's refund total and dispute state need to be columns (or rows) in the same durable store as the dedup table, looked up by charge ID on every event, rather than objects that live only as long as the process does. The routing logic itself (deciding which tracker a given event type belongs to) is the part of this pipeline that ports directly to a real system unchanged; the in-memory storage is the part that doesn't.
