# 3D Secure and SCA

Phase 3 Lesson 2 ("Handling Extra Authentication Redirects") deliberately left one thing unexplained: *why* a PaymentIntent's status sometimes moves to a value indicating additional action is required instead of resolving straight to success, and what that extra step actually is. This lesson closes that loop — the mechanism is called 3D Secure (3DS), and the regulatory reason it exists in the EU/UK is Strong Customer Authentication (SCA) under PSD2.

## 1. What 3D Secure Actually Does

3D Secure is an additional authentication step layered on top of a card payment: instead of the card details alone being enough to authorize a charge, the card issuer's own bank inserts a challenge — typically a redirect to a bank-hosted page asking for a one-time code (sent via SMS or an app) or a biometric confirmation (fingerprint/face ID inside the bank's app). Only after the customer completes that challenge does the issuer approve the charge. This is a bank-side, issuer-controlled step; your integration doesn't implement the authentication logic itself, it just has to redirect the customer to it and handle the result.

## 2. SCA and PSD2 (Developer-Level Overview)

Strong Customer Authentication is a regulatory requirement, originating from the EU/UK's PSD2 (Payment Services Directive 2), that pushes many card-not-present transactions to require this kind of extra authentication rather than card details alone. The precise scope — which transactions are covered, which exemptions apply (e.g., low-value transactions, recurring/subscription payments after an initial SCA-authenticated charge, merchant-initiated transactions), and any thresholds involved — is set by regulation and enforced differently by different banks and card networks, and can be revised over time; treat this section as a developer-level orientation, not legal or compliance advice, and verify current regulatory scope with your legal/compliance team or your payment provider's own SCA documentation before making product decisions based on it. The developer-relevant takeaway is narrower and more stable: *some fraction of your transactions, especially ones involving EU/UK-issued cards, will require this extra step, and your integration must handle it gracefully rather than assume every payment resolves in one call.*

## 3. Handling the Extra Redirect/Challenge Step in Code

This is exactly the gap Phase 3 Lesson 2 flagged and set aside: when a PaymentIntent's status becomes `requires_action`, it means the issuer has requested a 3DS challenge, and Stripe.js's confirmation call (or the equivalent client-side call for another provider) will redirect the customer through that challenge before returning control to your page. Your code has to branch on that status rather than assuming a two-outcome world of "succeeded" or "hard failure" — the same warning Phase 3 Lesson 2 made in general terms now has a name and a mechanism behind it.

```text
Payment flow with a 3DS challenge inserted:

  [requires_payment_method]
          |
          | customer submits card details
          v
  [requires_confirmation]
          |
          | client confirms the PaymentIntent
          v
  [requires_action]  <-- issuer demands 3DS authentication
          |
          | customer is redirected to issuer's bank page,
          | enters one-time code / confirms biometric
          v
     (challenge completed?)
       /            \
     yes             no / abandoned
      |                 |
      v                 v
  [processing]      [requires_action stays, or transitions
      |               to canceled after a timeout/abandonment]
      v
  [succeeded]
```

## Comparison

| Provider | How the 3DS/SCA requirement surfaces in code |
|---|---|
| Stripe | The PaymentIntent's `status` becomes `requires_action` (Phase 3, Lesson 1 and 2); Stripe.js's confirmation call performs the redirect through the issuer's challenge automatically and returns the post-challenge status when control comes back to your page |
| Razorpay | Surfaces as part of the hosted Checkout widget's flow (Phase 4) — the widget itself typically handles redirecting the customer through any issuer-required authentication step as part of completing the overlay, before firing its completion callback; exact status/event naming should be verified against current Razorpay docs |
| PayPal | Surfaces primarily through PayPal's own buyer-approval UI (Phase 5) — since the buyer is already being routed through PayPal's hosted approval flow for the "approve" step, any additional issuer-side authentication tends to be folded into that same redirect rather than appearing as a distinct status your code must separately branch on; exact behavior should be verified against current PayPal docs |

## Common Mistakes

- Only testing the happy path (no 3DS challenge triggered) in development, then being surprised in production when EU/UK-issued test or real cards trigger the extra step — most test-mode card numbers don't require 3DS by default, so a developer who never deliberately tests with a 3DS-triggering test card can ship code that silently breaks on the `requires_action` branch.
- Assuming every payment resolves to `succeeded` or a hard error in one call — exactly the mistake Phase 3 Lesson 2 warned about generally; code that doesn't handle the intermediate action-required state will treat a customer mid-challenge as if something went wrong, or simply hang.
- Not setting a reasonable timeout or abandonment path for a customer who starts a 3DS challenge and never completes it (closes the tab, gives up on the bank's page) — without handling this, the payment object can sit indefinitely in a pending "waiting for authentication" state with no clear resolution.
- Treating 3DS/SCA compliance as satisfied purely because a hosted field or hosted checkout is in use — as Phase 1 and Phase 3 both noted, hosted fields address PCI scope, not authentication requirements; SCA is a separate, additional concern layered on top of however the card was captured.

## Hands-On Exercises

1. **Trace the full happy-path-with-challenge flow (paper exercise).** Starting from `requires_payment_method`, write out every state the payment object passes through for a payment that (a) is confirmed by the client, (b) triggers a 3DS challenge that the customer completes successfully, and (c) ultimately succeeds. Use the ASCII diagram in section 3 as a reference, but write the sequence in your own words.

2. **Trace the abandonment path.** Using the same starting point, write out what you'd expect to happen if the customer is redirected to the issuer's challenge page but closes the browser tab without completing it. What should your application do if it never receives a final resolution?

3. **Identify the regulatory vs. mechanical split.** In one or two sentences each, separate what 3D Secure *does mechanically* (the redirect/challenge itself) from *why it exists* (SCA under PSD2) — and note which of the two a typical backend developer needs to implement versus simply be aware of.

4. **Spot the untested branch.** A developer's client-side code does `if (paymentIntent.status === "succeeded") { showSuccess(); } else { showGenericError(); }` immediately after the confirmation call, and has only ever tested with cards that don't trigger 3DS. Write down what a real customer whose card requires the extra challenge would experience with this code, referencing Phase 3 Lesson 2's identical broken-assumption exercise.

## Interview Q&A

**Q: What is 3D Secure, mechanically?**
A: An additional authentication step, controlled by the card issuer's bank, typically implemented as a redirect to a bank-hosted page requesting a one-time code or biometric confirmation, inserted into the payment flow before the issuer will approve the charge.

**Q: Why does 3D Secure exist for EU/UK transactions specifically?**
A: Because of Strong Customer Authentication (SCA), a requirement under the EU/UK's PSD2 regulation — exact scope, exemptions, and thresholds are set by regulation and can shift, so treat specifics as something to verify with current documentation rather than fixed facts.

**Q: How does the 3DS requirement surface in a Stripe integration, concretely?**
A: The PaymentIntent's `status` moves to `requires_action`; Stripe.js's confirmation call redirects the customer through the issuer's challenge and returns the resulting status once the customer is back on your page — this is exactly the status Phase 3 Lesson 2 flagged without naming the underlying mechanism.

**Q: What's the risk of only testing the happy path (no 3DS) during development?**
A: Code that assumes every confirmation call resolves directly to success or a hard failure will mishandle the `requires_action` (or equivalent) branch in production, silently breaking for the subset of real customers, often EU/UK cardholders, whose issuer requires the extra challenge.

**Q: What should happen if a customer starts a 3DS challenge and never completes it?**
A: The application needs a defined timeout or abandonment path rather than leaving the payment indefinitely pending — otherwise the payment object can sit in an unresolved "waiting for authentication" state with no clear outcome for the customer or your order system.
