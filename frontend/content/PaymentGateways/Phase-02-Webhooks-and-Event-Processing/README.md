# Phase 2: Webhooks and Event Processing

## What You'll Learn

Move past the checkout call itself and into how you find out what actually happened to a payment: why the client-side "success" redirect can't be trusted as the source of truth, how providers prove a webhook genuinely came from them via HMAC signature verification, and why "at-least-once" delivery means every handler you write has to be idempotent.

## Learning Objectives

- Explain why webhooks — not client-side redirects/callbacks — are the authoritative source of truth for payment outcomes
- Implement HMAC-SHA256 signature verification correctly, including constant-time comparison
- Write webhook handlers that are idempotent and safe against redelivery

## Topics

| File | Topic | Time |
|------|-------|------|
| [01-Why-Webhooks-Exist.md](01-Why-Webhooks-Exist.md) | The client-side confirmation problem, how server-to-server webhooks close the gap, and common payment event types | 1 day |
| [02-Signature-Verification.md](02-Signature-Verification.md) | Why and how to verify HMAC-SHA256 webhook signatures, including constant-time comparison to avoid timing attacks | 1 day |
| [03-At-Least-Once-Delivery-and-Idempotent-Handlers.md](03-At-Least-Once-Delivery-and-Idempotent-Handlers.md) | At-least-once delivery guarantees, deduplicating by event ID, and returning 2xx quickly by processing work asynchronously | 1 day |

## Estimated Time

3 days

## Next Phase

→ [Phase 3: Stripe Integration](../Phase-03-Stripe-Integration/README.md)
