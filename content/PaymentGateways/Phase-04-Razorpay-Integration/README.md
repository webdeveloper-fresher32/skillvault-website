# Phase 4: Razorpay Integration

## What You'll Learn

Apply the general concepts from Phases 1-2 to Razorpay specifically: create Orders and integrate Razorpay Checkout, correctly implement Razorpay's two-part signature verification model (a client-relayed signature check in addition to webhook verification), and avoid confusing the two different secrets each check depends on.

## Learning Objectives

- Create Orders and integrate Razorpay Checkout as the client-side collection step
- Correctly implement BOTH the client-side signature verification and webhook signature verification, understanding why both are required
- Avoid confusing the API key secret (client-side check) with the webhook secret (webhook check)

## Topics

| File | Topic | Time |
|------|-------|------|
| [01-Orders-API-and-Razorpay-Checkout.md](01-Orders-API-and-Razorpay-Checkout.md) | Creating an Order (amount in paise), Razorpay Checkout as the hosted client-side widget, and mapping both onto Phase 1's 3-step flow | 1 day |
| [02-Client-and-Server-Signature-Verification.md](02-Client-and-Server-Signature-Verification.md) | Razorpay's distinctive client-side signature check (HMAC of `order_id + "|" + payment_id`), why it exists, and why it's additional to webhook verification | 1 day |
| [03-Razorpay-Webhooks-in-Practice.md](03-Razorpay-Webhooks-in-Practice.md) | Verifying webhook signatures with Phase 2's general HMAC pattern using Razorpay's separate webhook secret, and key event types | 1 day |

## Estimated Time

3 days

## Next Phase

→ [Phase 5: PayPal Integration](../Phase-05-PayPal-Integration/README.md)
