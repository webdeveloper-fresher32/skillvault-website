# Phase 1: Payment Fundamentals

## What You'll Learn

Get grounded in the concepts every payment integration shares before touching any single provider's SDK: the universal three-step checkout shape, why PCI scope matters and how hosted fields avoid it, and how to work safely in test mode with idempotency keys.

## Learning Objectives

- Understand the shared checkout-flow shape used by every major payment provider
- Understand how hosted fields reduce PCI scope, and what SAQ level applies to a given architecture
- Use idempotency keys correctly to make retried payment requests safe

## Topics

| File | Topic | Time |
|------|-------|------|
| [01-The-Checkout-Flow-Shape.md](01-The-Checkout-Flow-Shape.md) | The universal 3-step checkout shape (create → collect method → confirm/capture) and how Stripe/Razorpay/PayPal name it differently | 1 day |
| [02-PCI-Scope-and-Hosted-Fields.md](02-PCI-Scope-and-Hosted-Fields.md) | What PCI DSS scope means, how hosted fields keep raw card data off your server, and SAQ A/A-EP/D | 1 day |
| [03-Test-Mode-and-Idempotency-Keys.md](03-Test-Mode-and-Idempotency-Keys.md) | Test API keys and test cards, idempotency keys, and the duplicate-charge bug they prevent | 1 day |

## Estimated Time

3 days

## Next Phase

→ [Phase 2: Webhooks and Event Processing](../Phase-02-Webhooks-and-Event-Processing/README.md)
