# Stripe vs. Razorpay vs. PayPal Comparison

Phases 2 through 9 covered webhooks, then Stripe, Razorpay, and PayPal one at a time, plus the other cross-cutting concerns — subscriptions, refunds and disputes, security, and international payments — that apply to all three. This lesson pulls those separate threads into a single decision framework: not "which provider is best," but "which provider (or combination) fits a given product's requirements," with every claim below traceable back to the earlier lesson that established it.

## 1. Fee Structure Shape (Not Exact Numbers)

No lesson in this course ever asserted a specific percentage or fixed fee as current fact for any provider — Phase 7 Lesson 2 explicitly warned against treating any dollar figure for dispute fees as permanent, and Phase 9 Lesson 3 gave the same warning for currency-conversion fee percentages. What is stable enough to teach is the *shape* fees generally take: a percentage of the transaction amount plus a small fixed fee per successful charge, with additional percentage-based fees layered on for currency conversion (Phase 9, Lesson 3) and disputes (Phase 7, Lesson 2) when they occur. All three providers follow this same general shape; the actual numbers move over time and by region, so pull current numbers from each provider's live pricing page at decision time rather than from any course material, this one included.

```
totalCost = (amount * feePercent / 100) + fixedFee
          + (isForeignCurrency ? amount * conversionFeePercent / 100 : 0)
          + (isDisputed ? disputeFee : 0)
```

## 2. Developer Experience and SDK Quality

Phases 3 through 5 exposed a real structural difference in integration complexity, not just naming:

- **Stripe** (Phase 3): static secret/publishable test keys (`sk_test_...`/`pk_test_...`, Phase 1 Lesson 3), a `PaymentIntent` status lifecycle (`requires_payment_method` → `requires_confirmation` → `processing` → `succeeded`, Phase 3 Lesson 1), and a fully-hosted Checkout Session option that needs almost no client code. Webhook verification is a single library call, `stripe.webhooks.constructEvent(rawBody, signatureHeader, endpointSecret)` (Phase 3, Lesson 3).
- **Razorpay** (Phase 4): also static test keys (`rzp_test_...`), but adds a course-unique client-side signature check on top of server-side webhook verification — `HMAC-SHA256(key_secret, order_id + "|" + payment_id)` (Phase 4, Lesson 2) — as an extra step between checkout completion and trusting the client's callback.
- **PayPal** (Phase 5): the only one of the three requiring an OAuth2 client-credentials grant before any API call can be made — Phase 5 Lesson 1 called this out explicitly as "a genuinely different shape from Phases 3-4, not just a naming difference," including token caching with a safety margin before expiry. Its Orders v2 flow is also the most explicitly staged of the three: separately-named Create → Approve → Capture steps (Phase 5, Lesson 2), where an approved-but-uncaptured order never moves money.

Webhook verification mechanics differ meaningfully too: Stripe and Razorpay both verify a local HMAC-SHA256 signature over the raw request body (Phase 2, Lesson 2; Phase 3, Lesson 3; Phase 4, Lesson 3), while PayPal's webhook verification instead requires calling back into a PayPal API endpoint with the received headers and getting a `verification_status` in response (Phase 5, Lesson 3) — meaning a PayPal verification failure can mean either a forged webhook or a transient network/auth problem, a distinction Stripe's and Razorpay's local-HMAC approach doesn't have to make.

## 3. Feature Parity Recap

Subscriptions (Phase 6), refunds and disputes (Phase 7), and 3D Secure/SCA (Phase 8) were taught largely as shared concepts across all three providers, with the differences being in exactly how much of each provider's specific behavior this course was willing to assert as verified fact:

- **Subscriptions** (Phase 6, Lesson 1): the same conceptual state machine (`trialing` → `active` → `past_due` → recovered or `canceled`/`unpaid`) was mapped onto all three — Stripe's Subscription object with a `status` field, Razorpay's Subscription resource, and PayPal's Billing Plan + Subscription resource — but exact retry counts and day-spacing for dunning (Phase 6, Lesson 3) were explicitly left unasserted for any of the three ("do not treat any specific number of retries or number of days between them as a fixed, permanent fact").
- **Disputes** (Phase 7, Lesson 2 and 3): only Stripe's event names were verified as concrete strings in this course — `charge.dispute.created` (carried from Phase 3, Lesson 3) and `charge.refunded`. Razorpay's and PayPal's equivalent dispute/refund event names were explicitly hedged rather than asserted.
- **3D Secure** (Phase 8, Lesson 3): Stripe's surfacing was taught concretely — the PaymentIntent's `status` becomes `requires_action`, closing the loop from Phase 3 Lesson 2, and Stripe.js handles the redirect automatically. Razorpay's and PayPal's 3DS surfacing were both described as folded into their respective hosted checkout/approval widgets, but hedged as "exact behavior should be verified" rather than asserted in detail.

The practical upshot: this course can speak with more verified confidence about Stripe's exact event names and status values than about Razorpay's or PayPal's, not because Stripe is more feature-complete, but because those specific strings were the ones this course chose to verify and assert.

## Comparison

| Dimension | Stripe | Razorpay | PayPal |
|---|---|---|---|
| Fee shape | Percentage + fixed fee per charge, plus conversion/dispute fees when applicable (Phase 7 L2, Phase 9 L3); exact numbers not asserted by this course | Same general shape as Stripe; exact numbers not asserted by this course | Same general shape as Stripe; exact numbers not asserted by this course |
| Regional strength | Broad global reach, particularly strong across US/EU and other developed markets (Phase 9, Lesson 2) | India-first, deep native support for UPI, India-specific card networks, and net-banking rails (Phase 9, Lesson 2) | Broad global reach plus an established buyer-side network effect, historically US/EU-heavy (Phase 9, Lesson 2) |
| Currency/amount representation | Integer minor units (e.g. cents); zero-decimal currencies like JPY handled per Phase 9 Lesson 1's `10^decimalPlaces` rule | Integer minor units (paise, Phase 4 Lesson 1); same Phase 9 Lesson 1 rule applies | Decimal string (e.g. `"20.00"`) on Orders v2 — a genuinely different representation from Stripe/Razorpay's integer minor units (Phase 9, Lesson 1) |
| Subscription support | Subscription object with a `status` field mapped onto the shared trialing/active/past_due/canceled state machine (Phase 6, Lesson 1) | Subscription resource, same shared state machine (Phase 6, Lesson 1) | Billing Plan + Subscription resource, same shared state machine (Phase 6, Lesson 1) |
| Dispute handling | Verified concrete event name `charge.dispute.created` (Phase 3 L3, Phase 7 L2); structured evidence-window flow (Phase 7, Lesson 3) | Same evidence-window concept (Phase 7, Lesson 2); specific event names hedged/not asserted by this course | Same evidence-window concept (Phase 7, Lesson 2); specific event names hedged/not asserted by this course |
| Webhook verification complexity | Local HMAC-SHA256 over raw body via `stripe.webhooks.constructEvent`, one library call (Phase 3, Lesson 3) | Local HMAC-SHA256 over raw body with a separate webhook secret, same general pattern as Phase 2 (Phase 4, Lesson 3), plus an *additional* course-unique client-side signature check (Phase 4, Lesson 2) | No local HMAC — requires an authenticated callback to a PayPal verification API endpoint, so a failure can mean forgery or a transient auth/network issue (Phase 5, Lesson 3) |
| Integration complexity (auth model) | Static secret/publishable test keys (Phase 1, Lesson 3) | Static test keys (Phase 1, Lesson 3), plus the extra client-side signature-relay step (Phase 4, Lesson 2) | OAuth2 client-credentials grant required before any API call, with token caching (Phase 5, Lesson 1) — the most additional setup work of the three |
| Idempotency mechanism | `Idempotency-Key` header, honored ~24 hours (Phase 1, Lesson 3) | No general-purpose idempotency header for Orders/Payments — only a payout-specific header that doesn't apply here; a timed-out call must be resolved by GET-ing order status, not blind retry (Phase 1, Lesson 3) | `PayPal-Request-Id` header (Phase 1, Lesson 3) |

## Common Mistakes

- Choosing a provider based on fee percentages alone, without checking regional and feature fit first — Phase 9 Lesson 2 framed provider choice as a market-fit question, not a "which provider is objectively cheapest" question, and a marginally cheaper provider that lacks a market's preferred payment method (e.g. UPI for an India-first product) can cost far more in lost conversion than it saves in fees.
- Underestimating PayPal's integration cost because its API "looks similar" to Stripe's or Razorpay's on the surface — Phase 5 Lesson 1 called out the OAuth2 client-credentials requirement as a genuinely different shape, not a naming difference, and it adds real engineering time (token acquisition, caching, refresh handling) that a fee-only comparison won't surface.
- Assuming feature parity where this course only verified one provider's specifics — treating Razorpay's or PayPal's hedged event names as if they were as concretely nailed-down as Stripe's `charge.dispute.created` or `charge.refunded` is a mistake; those names still need to be confirmed against live provider documentation before being relied upon in production code.
- Picking "the best" provider in the abstract rather than the best fit for a specific target market, repeating the exact framing mistake Phase 9 Lesson 2's Common Mistakes section already warned against.
- Ignoring that Razorpay's Orders/Payments API has no general-purpose idempotency header (Phase 1, Lesson 3) and building retry logic that assumes one exists, risking duplicate charges on a retried timeout.

## Hands-On Exercises

1. **India-first subscription product.** A team is building a subscription-based product where the large majority of customers are in India, with occasional customers elsewhere. Recommend a provider (or combination) and justify it in two or three sentences, citing Phase 9 Lesson 2's regional findings and Phase 6 Lesson 1's subscription state machine.
2. **US/EU marketplace with disputes as a major concern.** A team is building a US/EU-focused marketplace expecting a meaningful volume of chargebacks and disputes. Recommend a provider and justify it in two or three sentences, citing this lesson's Comparison table row on dispute handling and Phase 7's evidence-submission flow.
3. **Global product needing both card and India-specific rails.** A team's customers are split between India and North America/Europe, and both segments need to see locally preferred payment methods. Recommend a provider combination (not necessarily a single provider) and justify it in two or three sentences, citing Phase 9 Lesson 2's framing that a single global provider may not fit every region equally well.
4. **Estimate engineering time for a PayPal-only MVP.** Using Phase 5 Lesson 1's OAuth2 client-credentials requirement and Phase 5 Lesson 2's three-step Create/Approve/Capture flow, list two specific engineering tasks a Stripe-only MVP would not need that a PayPal-only MVP would.
5. **Justify dropping a cheaper provider.** A stakeholder proposes switching to whichever provider has the lowest quoted fee percentage, without evaluating anything else. Using this lesson's Common Mistakes section, write two or three sentences explaining what additional questions should be answered before agreeing to the switch.

## Interview Q&A

**Q: How would you choose between Stripe, Razorpay, and PayPal for a new product?**
A: Not by fees alone — start with target market fit (Razorpay for India-first products given its native UPI and local-rail support, Stripe/PayPal for broader global/US-EU reach, per Phase 9 Lesson 2), then check feature and integration-complexity fit for the product's specific needs (subscriptions, dispute volume, PayPal's added OAuth2 setup cost), and only then compare fee structures, since fees follow a similar percentage-plus-fixed-fee shape across all three.

**Q: Is PayPal's integration effort really different from Stripe's or Razorpay's, or just a different set of names?**
A: Genuinely different, not just naming — PayPal requires an OAuth2 client-credentials grant with token caching before any API call can be made (Phase 5, Lesson 1), while Stripe and Razorpay both use static test/live keys directly (Phase 1, Lesson 3). That's real additional integration work, not cosmetic.

**Q: Why can't you treat Razorpay's and PayPal's dispute event names as verified facts the way you can Stripe's?**
A: Because this course only verified Stripe's specific event name, `charge.dispute.created` (Phase 3, Lesson 3; Phase 7, Lesson 2), while Razorpay's and PayPal's equivalents were explicitly hedged rather than asserted — they still need to be checked against each provider's live documentation before being relied on.

**Q: What's the risk of choosing a provider based only on its quoted fee percentage?**
A: It ignores regional and feature fit — Phase 9 Lesson 2 showed that a provider missing a market's preferred payment method (like UPI for India) can lose far more in conversion than its lower fee saves, and a fee-only comparison also misses integration-complexity differences like PayPal's OAuth2 requirement (Phase 5, Lesson 1) that add real engineering time.

**Q: How does webhook verification complexity differ across the three providers?**
A: Stripe and Razorpay both verify a local HMAC-SHA256 signature over the raw request body (Phase 2 Lesson 2, Phase 3 Lesson 3, Phase 4 Lesson 3); PayPal instead requires an authenticated callback to a PayPal API endpoint to get a verification status (Phase 5, Lesson 3), which means a PayPal verification failure can indicate either forgery or a transient auth/network problem — a distinction the other two don't have to make.
