# Full and Partial Refunds

Refunding money sounds like the simplest operation in a payment integration — call an API, money goes back — but two things trip up real implementations: nothing stops a caller from issuing more refunds than the original charge unless your own server enforces it, and the API call returning success doesn't mean the customer has the money yet. Both are variations on lessons this course has already covered: server-side validation you can't outsource to the client, and the webhook-is-the-authority model from Phase 2.

## 1. Full vs. Partial Refunds

A **full refund** returns the entire amount of a charge in one call. A **partial refund** returns a specified amount that's less than the full charge, and — unlike a full refund — a single charge can have multiple partial refunds issued against it over time, as long as their sum never exceeds the original amount. All three major providers (Stripe, Razorpay, PayPal) support both shapes; the constraint that matters isn't provider-specific, it's arithmetic: cumulative refunds against one charge must never exceed what was originally charged.

```text
Original charge: $100.00
        |
        +--> Partial refund #1: $30.00   (cumulative refunded: $30.00, remaining refundable: $70.00)
        |
        +--> Partial refund #2: $70.00   (cumulative refunded: $100.00, remaining refundable: $0.00)
        |
        +--> Attempted refund #3: $0.01  --> REJECTED (would exceed the original charge)
```

Nothing in the shape of the API call itself prevents you from requesting a refund larger than what's left — that check has to be enforced by whoever is issuing the refund, which in practice means your own server, not the provider's SDK and not the browser.

## 2. Refund Timing (Not Instant)

A refund API call returning success does not mean the money has landed back in the customer's account. Refunds are typically NOT instant from the customer's point of view — the provider still has to reverse the transaction with the underlying card network or bank, and that reversal takes real-world bank processing time, commonly on the order of several business days depending on the customer's card issuer or bank, the original payment method, and the provider. Treat "the refund was successfully initiated" and "the customer has their money back" as two different facts, separated by an unpredictable delay outside your control.

```text
Your server calls the refund API
        |
        v
Provider accepts the request and returns success --> refund is INITIATED
        |
        v
Provider processes the reversal with the card network / bank
        |
        v
(days pass - exact timing depends on issuer, method, and provider)
        |
        v
Funds actually appear back in the customer's account --> refund is COMPLETE
```

## 3. Confirming via Webhook, Not Just the API Response (Phase 2)

This is Phase 2's client-side-confirmation lesson again, just on the refund side of the relationship instead of the payment side. Your server calling the refund API and getting back a 200 only proves the provider *accepted the request* — it's the same trap as trusting a client-side checkout redirect as proof a payment succeeded. The authoritative signal that a refund actually processed is the provider's refund webhook (the same "refund issued" event category Phase 2's Lesson 1 introduced, and the same `charge.refunded` event Phase 3 wired into the Stripe event-type switch). Update your internal ledger and customer-facing status only when that webhook arrives, not the moment your outbound API call returns.

```text
Your server calls "refund this charge"
        |
        v
API responds 200  -----------------------------> This proves: "the provider accepted
                                                    and is now processing the request."
                                                    It does NOT prove the refund completed.
        |
        v
Provider's backend processes the reversal
        |
        v
Provider sends a refund webhook (e.g. "refund issued" / "charge.refunded")
        |
        v
THIS is what your server should treat as authoritative for updating order status,
adjusting internal ledgers, and telling the customer "your refund has processed."
```

## 4. Example: Cumulative Refund Tracking

The function below tracks how much has been refunded against one original charge and rejects any request that would push the cumulative total over that amount. This is pure logic with no live credentials required, run directly with `node`.

```js
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

// Original charge: 10000 (e.g. $100.00 in cents)
const tracker = makeRefundTracker(10000);

console.log("Scenario 1: valid partial refund of 3000");
console.log(tracker.requestRefund(3000));

console.log("\nScenario 2: valid refund of remaining 7000 (brings total to exactly the original 10000)");
console.log(tracker.requestRefund(7000));

console.log("\nScenario 3: invalid over-refund attempt of 1 more, after already refunded in full");
console.log(tracker.requestRefund(1));

console.log("\nFinal total refunded:", tracker.getTotalRefunded());
```

Actual output from running this with `node`:

```text
Scenario 1: valid partial refund of 3000
{ ok: true, refunded: 3000, totalRefunded: 3000, remaining: 7000 }

Scenario 2: valid refund of remaining 7000 (brings total to exactly the original 10000)
{ ok: true, refunded: 7000, totalRefunded: 10000, remaining: 0 }

Scenario 3: invalid over-refund attempt of 1 more, after already refunded in full
{
  ok: false,
  reason: 'Refund of 1 would exceed original charge of 10000 (already refunded 10000, only 0 refundable)'
}

Final total refunded: 10000
```

The partial refund (scenario 1) succeeds, the top-up to exactly the full original amount (scenario 2) succeeds, and the over-refund attempt (scenario 3) is correctly rejected with `totalRefunded` still capped at `10000` — the tracker never lets the cumulative total exceed the original charge, no matter how the individual refund amounts are split.

## Comparison

| Aspect | Stripe (conceptual) | Razorpay (conceptual) | PayPal (conceptual) |
|---|---|---|---|
| Full refund | Refund call against the charge/PaymentIntent with no amount specified — refunds the full remaining amount | Refund call against the payment ID with no amount specified — refunds the full remaining amount | Refund call against the capture/order ID with no amount specified — refunds the full remaining amount |
| Partial refund | Refund call with an explicit amount less than the remaining refundable balance | Refund call with an explicit amount less than the remaining refundable balance | Refund call with an explicit amount less than the remaining refundable balance |
| Multiple partial refunds against one charge | Supported, up to the original total | Supported, up to the original total | Supported, up to the original total |
| Enforces "can't exceed original amount" server-side (provider) | Provider typically rejects an over-refund attempt at its API layer too, but exact error shape/timing should be verified against current docs | Same caveat — verify current docs | Same caveat — verify current docs |
| Confirms refund completion via | A refund-related webhook event (verify current event name in provider docs; Stripe's is `charge.refunded` per Phase 3) | A refund-related webhook event (verify current event name in provider docs) | A refund-related webhook event (verify current event name in provider docs) |

Exact request/response syntax (field names, endpoint paths) differs per provider and changes over time — verify current syntax against each provider's docs at implementation time. The full/partial/cumulative-tracking pattern itself is consistent across all three.

## Common Mistakes

- Not tracking cumulative refunds server-side and letting a caller (a buggy retry, a support tool, a race between two requests) accidentally refund more than the original charge — the provider may also reject an over-refund at its own API layer, but relying solely on that as your only safety net means a bug can still attempt the request and depend on the provider catching it, rather than your own system preventing it in the first place.
- Treating the refund API call's 200 response as confirmation the customer has received their money — it only confirms the refund was INITIATED, not completed. This is the exact same mistake Phase 2 warned about for the client-side checkout redirect, applied to the refund side: the authoritative signal is the webhook, not the synchronous API response.
- Updating customer-facing "refund complete" messaging immediately after the API call returns, then having no way to reconcile if the refund is later reported as failed by the provider (refunds can, in some cases, themselves fail — e.g. the original funding source no longer exists) — mirrors Phase 2's point about needing a reconciliation path, not just a happy-path webhook handler.
- Issuing a partial refund without recording it against the specific charge's running total in your own database, making it impossible to answer "how much of this charge has already been refunded?" without querying the provider's API every time.

## Hands-On Exercises

1. **Run the cumulative-refund-tracking function as shown.** Save `makeRefundTracker` and the three-scenario demo from section 4 into one file and run it with `node`. Confirm your output matches what's shown above: scenario 1 succeeds, scenario 2 succeeds and brings the total to exactly the original amount, and scenario 3 is rejected.
2. **Add a fourth scenario.** Extend the file with a fresh tracker (`makeRefundTracker(5000)`), issue one refund of `2000`, then attempt a refund of `3001`. Run it with `node` and confirm the result is rejected, and that the reason message correctly reports `3000` (not `5000`) as the amount still refundable.
3. **Zero and negative amounts.** Call `requestRefund(0)` and `requestRefund(-500)` against a fresh tracker and confirm both are rejected by the `amount <= 0` check, rather than being silently treated as no-ops or partial successes.
4. **Paper exercise: where does the webhook fit?** Sketch a sequence diagram with three participants — your server, the payment provider, and the customer's bank — showing: your server calling the refund API, the API responding 200, the provider processing the reversal with the bank, and the refund webhook arriving afterward. Mark clearly which step is the earliest point your server should update the order's status to "refund confirmed."
5. **Trace a rejected over-refund through to the API layer.** Using the tracker's rejection from scenario 3 as a model, write out (as pseudocode, not runnable code) what your HTTP handler should return to a caller that requests an over-refund — what status code, and what should NOT happen (i.e., no API call to the provider should be attempted at all once your own cumulative check fails).

## Interview Q&A

**Q: What's the difference between a full and a partial refund?**
A: A full refund returns the entire amount of a charge in one call; a partial refund returns a specified amount less than the full charge, and a single charge can have multiple partial refunds issued against it over time, as long as their sum never exceeds the original amount.

**Q: Why is server-side cumulative refund tracking necessary if the provider might reject an over-refund anyway?**
A: Relying solely on the provider to catch an over-refund means a bug can still attempt the request and depend on the provider's own validation as the only safety net; tracking cumulative refunds yourself prevents the invalid request from ever being sent and gives your own system an authoritative running total independent of an extra round trip to the provider.

**Q: Does a refund API call returning 200 mean the customer has their money back?**
A: No — it means the provider accepted and is processing the refund request. The money reaching the customer's account depends on real-world bank/card-network processing time, which is not instant. Whether the refund actually completed should be confirmed via the provider's refund webhook, not the synchronous API response.

**Q: How does refund confirmation relate to Phase 2's webhook lesson?**
A: It's the same principle applied to refunds instead of payments: a synchronous response (whether a client-side redirect or a refund API's 200) only proves a request was accepted or a browser reached a URL — it doesn't prove the underlying event actually completed. The webhook, sent server-to-server from the provider's system of record, is the authoritative signal in both cases.

**Q: If a charge for $100 already has a $60 partial refund against it, what's the maximum a second refund request can be for?**
A: $40 — the original amount minus whatever has already been refunded. Any request above that remaining refundable balance should be rejected before it's ever sent to the provider.
