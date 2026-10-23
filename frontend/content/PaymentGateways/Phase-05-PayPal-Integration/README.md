# Phase 5: PayPal Integration

## What You'll Learn

Apply the general concepts from Phases 1-2 to PayPal specifically: implement PayPal's OAuth2 client-credentials flow (its most distinctive departure from Stripe's and Razorpay's static-key model), complete the create/approve/capture order flow, and verify PayPal webhooks via their API-based verification model rather than a local HMAC check.

## Learning Objectives

- Implement the OAuth2 client-credentials flow with token caching, avoiding a fresh token fetch on every API call
- Complete the create/approve/capture order flow using PayPal's Orders API v2 and PayPal Smart Buttons
- Verify PayPal webhooks via their API-based verification model, and understand how its failure modes differ from Stripe's/Razorpay's local HMAC checks

## Topics

| File | Topic | Time |
|------|-------|------|
| [01-OAuth2-Client-Credentials-Flow.md](01-OAuth2-Client-Credentials-Flow.md) | Why PayPal requires an OAuth2 client-credentials grant (vs. Stripe/Razorpay's static keys), and caching the resulting access token correctly | 1 day |
| [02-Orders-API-v2-Create-Approve-Capture.md](02-Orders-API-v2-Create-Approve-Capture.md) | PayPal's explicit create/approve/capture flow, PayPal Smart Buttons as the client-side step, and why capture is a separate step from authorization | 1 day |
| [03-PayPal-Webhooks-in-Practice.md](03-PayPal-Webhooks-in-Practice.md) | PayPal's API-based webhook verification model, why it differs from Stripe's/Razorpay's local HMAC checks, and key event types | 1 day |

## Estimated Time

3 days

## Next Phase

→ [Phase 6: Recurring Payments and Subscriptions](../Phase-06-Recurring-Payments-and-Subscriptions/README.md)
