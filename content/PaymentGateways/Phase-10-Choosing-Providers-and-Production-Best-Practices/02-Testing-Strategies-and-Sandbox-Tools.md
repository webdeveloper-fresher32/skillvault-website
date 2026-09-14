# Testing Strategies and Sandbox Tools

Phase 1 established that every provider offers a test mode with its own key prefix, and Phase 8 established that 3D Secure adds a challenge step most test cards don't trigger by default. This lesson turns those individual facts into a repeatable pre-production testing strategy — which test cards to reach for, how to get provider webhooks to a local machine, and what a minimum test matrix should cover before shipping a payment integration.

## 1. Test Cards for Simulating Outcomes

Phase 1 Lesson 3 gave exact Stripe test card numbers, and no other provider's test card numbers were given anywhere in this course:

- **Stripe** (verified, Phase 1 Lesson 3): `4242 4242 4242 4242` always succeeds; `4000 0000 0000 0002` is a generic decline; `4000 0000 0000 9995` simulates an insufficient-funds decline.
- **Razorpay**: no specific test card or UPI numbers were given in this course (Phase 1, Lesson 3; Phase 4). Razorpay's own dashboard/docs publish current test credentials for its sandbox — treat any specific number you use as something to pull from Razorpay's live documentation, not from this course.
- **PayPal**: no specific sandbox test card numbers were given in this course (Phase 1, Lesson 3; Phase 5). PayPal's sandbox instead centers on sandbox buyer/business test accounts (Phase 5, Lesson 1) rather than a small published list of card numbers — again, pull current details from PayPal's live sandbox documentation.
- **3D Secure specifically**: Phase 8 Lesson 3 explicitly flagged, as a common mistake, that most test-mode card numbers do not require a 3DS challenge by default — simulating a 3DS-required path needs a card number specifically documented to trigger it, and no such number was asserted in this course for any provider. Confirm the current 3DS-triggering test card for whichever provider you're testing against that provider's live documentation before relying on it.

```
// Illustrative only — pulls Stripe's three verified test numbers from Phase 1 Lesson 3.
// Razorpay/PayPal numbers are deliberately left as "check live docs," not asserted here.
const stripeTestCards = {
  success: "4242 4242 4242 4242",
  genericDecline: "4000 0000 0000 0002",
  insufficientFunds: "4000 0000 0000 9995",
};
```

## 2. Local Webhook Testing (Provider CLI vs. General-Purpose Tunneling)

Phase 3 Lesson 3 stated the underlying problem plainly: a provider's servers cannot reach a developer's `localhost`, so some form of tunneling or forwarding tool is required to receive webhooks locally — but that lesson deliberately described the need generically without naming a specific tool. Stripe separately publishes an official CLI (commonly invoked as `stripe listen --forward-to localhost:3000/webhook`) that forwards live test-mode events to a local endpoint and can also fire synthetic events on demand; if you use it, verify its exact current flags against Stripe's own CLI documentation rather than this course, since Phase 3's lesson text itself never named it.

Razorpay and PayPal have no equivalent course-verified CLI for local webhook forwarding. The provider-agnostic fallback that works for any of the three is a general-purpose local-tunneling tool that exposes a local port on a public HTTPS URL you can register as the provider's webhook endpoint during testing:

```bash
# Illustrative, provider-agnostic — works regardless of which provider's
# dashboard you paste the resulting HTTPS URL into as a webhook endpoint.
# Substitute your actual tunneling tool of choice; ngrok is shown as one
# widely-used example, not a course-verified recommendation for any provider.
ngrok http 3000
# → forwards https://<random-subdomain>.ngrok.io to http://localhost:3000
```

Whichever path you use, remember Phase 2 Lesson 2's constraint: the endpoint must still read the raw request body (not pre-parsed JSON) for signature verification to succeed, whether the request arrives via a provider CLI or a generic tunnel.

## 3. A Suggested Test Matrix

Combining Phase 1's checkout flow, Phase 2's at-least-once delivery guarantee, Phase 7's refund flow, and Phase 8's 3DS challenge into one pre-production checklist:

| Scenario | What it verifies | Course reference |
|---|---|---|
| Happy path | Full create → collect → confirm flow succeeds and the success webhook is received and processed | Phase 1, Lesson 1; Phase 2, Lesson 1 |
| Card decline | Application handles a failed-payment status/webhook gracefully, without treating a non-2xx client redirect as authoritative | Phase 1, Lesson 1; Phase 3, Lesson 3 |
| 3DS challenge | Application correctly branches on a `requires_action`-style status rather than assuming a binary succeeded/failed outcome | Phase 3, Lesson 2; Phase 8, Lesson 3 |
| Webhook re-delivery | Handler is idempotent — processing the same event ID twice has no duplicate side effect | Phase 2, Lesson 3 |
| Refund | Refund is confirmed via webhook, not just the API's 200 response, and cumulative refunds are capped at the original charge amount | Phase 7, Lesson 1 |

## Comparison

| Aspect | Stripe | Razorpay | PayPal |
|---|---|---|---|
| Test key prefix | `sk_test_...` / `pk_test_...` (Phase 1, Lesson 3) | `rzp_test_...` (Phase 1, Lesson 3) | Separate Sandbox app credentials, no key prefix (Phase 1, Lesson 3) |
| Verified test card numbers in this course | Yes — success, generic decline, insufficient-funds numbers given (Phase 1, Lesson 3) | None given — pull from Razorpay's live sandbox docs | None given — sandbox centers on test buyer/business accounts (Phase 5, Lesson 1) rather than published card numbers |
| 3DS-triggering test card | Not asserted by this course — most test cards don't trigger 3DS by default (Phase 8, Lesson 3) | Not asserted by this course | Not asserted by this course |
| Local webhook forwarding tool | An official CLI exists and is commonly used, though Phase 3's lesson text described the need only generically without naming it | None course-verified — use general-purpose tunneling | None course-verified — use general-purpose tunneling |
| Webhook signature model to test against | Local HMAC-SHA256 via `stripe.webhooks.constructEvent` (Phase 3, Lesson 3) | Local HMAC-SHA256 with a separate webhook secret (Phase 4, Lesson 3) | Authenticated verification API call, response-based (Phase 5, Lesson 3) |

## Common Mistakes

- Only testing the happy path and shipping to production without ever exercising a decline or 3DS-challenge path in a staging environment — Phase 3 Lesson 2 and Phase 8 Lesson 3 both depend on the application correctly branching on non-`succeeded` statuses, and that branch logic is untested if only the success case is ever run.
- Forgetting to also test webhook re-delivery/idempotency in a staging environment, not just the happy-path single-delivery case — Phase 2 Lesson 3 established that providers guarantee at-least-once, not exactly-once, delivery, so a handler that was only ever exercised with a single delivery per event may silently double-process on the first real retry.
- Treating a client-side "success" redirect as proof a test passed, instead of confirming the corresponding webhook actually arrived and was processed — the same trap Phase 1 Lesson 1 and Phase 2 Lesson 1 warned about for production traffic applies equally to test runs.
- Assuming a test card number verified for one provider (e.g. Stripe's `4242 4242 4242 4242`) works on another provider's sandbox — each provider's test credentials are provider-specific, and none of Razorpay's or PayPal's were asserted in this course.
- Parsing the request body as JSON before verifying a webhook signature in a local test setup, breaking signature verification the same way Phase 2 Lesson 2 warned against in production.

## Hands-On Exercises

1. **Build a Stripe-only happy-path/decline test pair.** Using the verified test card numbers from Phase 1 Lesson 3, write pseudocode for two test cases: one asserting a successful `PaymentIntent` reaches `succeeded`, one asserting a decline reaches a failed state without crashing the handler.
2. **Design a local webhook test setup for a multi-provider app.** For an app integrating Stripe and Razorpay side by side, describe how you'd receive both providers' webhooks locally — one option per provider — using this lesson's CLI-vs-tunnel distinction.
3. **Write the 5-scenario test matrix table.** Produce a table with rows for happy path, card decline, 3DS challenge, webhook retry, and refund, and columns for Stripe, Razorpay, and PayPal, filling each cell with either a concrete test approach (where this course gave enough detail) or "verify against live sandbox docs" (where it didn't).
4. **Simulate a webhook re-delivery in staging.** Describe, in pseudocode, how you would manually trigger the same event ID twice against a staging webhook endpoint to confirm the handler is idempotent, referencing Phase 2 Lesson 3's dedup-by-event-ID pattern.
5. **Identify what's missing from a happy-path-only test suite.** Given a test suite that only exercises successful charges, list the three scenarios from this lesson's test matrix that are still unverified and explain the production risk of each being untested.

## Interview Q&A

**Q: Why can't you rely on a single set of test card numbers across Stripe, Razorpay, and PayPal?**
A: Because test credentials are provider-specific — this course verified exact Stripe test card numbers (Phase 1, Lesson 3), but Razorpay's and PayPal's equivalents were never asserted and must be pulled from each provider's own live sandbox documentation.

**Q: How would you test webhooks locally before a provider can reach your production domain?**
A: Expose your local endpoint through a tunneling tool so the provider's servers have a public HTTPS URL to call — some providers publish an official CLI for this, while for others a general-purpose tunneling tool is the provider-agnostic fallback; either way, the endpoint still needs to read the raw request body for signature verification to succeed (Phase 2, Lesson 2).

**Q: What's a common gap in payment-integration test suites?**
A: Only testing the happy path — never exercising a decline, a 3DS challenge, or a duplicate webhook delivery in staging. Since providers guarantee at-least-once (not exactly-once) delivery (Phase 2, Lesson 3), an idempotency bug that a happy-path-only suite would never catch can surface as a duplicate charge or double-fulfilled order in production.

**Q: Why is it hard to test the 3D Secure challenge path?**
A: Because most test-mode card numbers don't trigger a 3DS challenge by default (Phase 8, Lesson 3) — you need a card number specifically documented by that provider to force the challenge, and no such number was asserted as a course-verified fact for any of the three providers here.

**Q: What should a refund test actually confirm, beyond the API call succeeding?**
A: That the refund webhook arrives and is processed — Phase 7 Lesson 1 established that a 200 response from a refund API call only proves the refund was initiated, not completed, so a refund test that stops at the API response without checking the webhook path is incomplete.
