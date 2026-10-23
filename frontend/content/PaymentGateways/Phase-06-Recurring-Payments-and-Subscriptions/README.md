# Phase 6: Recurring Payments and Subscriptions

## What You'll Learn

Move from one-off checkout (Phases 1-5) into recurring billing: model the subscription lifecycle correctly across providers, understand how proration works when a customer changes plans mid-cycle, and design a dunning strategy for failed renewal charges that doesn't rely solely on the provider's built-in retries.

## Learning Objectives

- Model the subscription lifecycle correctly, including the states most apps get wrong (`trialing`, `past_due`)
- Compute proration for mid-cycle plan upgrades/downgrades
- Design a dunning strategy that combines provider retry logic with app-level grace periods and notifications

## Topics

| File | Topic | Time |
|------|-------|------|
| [01-Subscription-Lifecycle.md](01-Subscription-Lifecycle.md) | The common subscription state machine, how Stripe/Razorpay/PayPal model it conceptually, and subscription webhook events | 1 day |
| [02-Proration-and-Plan-Changes.md](02-Proration-and-Plan-Changes.md) | Why proration exists, the days-remaining/total-days calculation, and provider differences in immediate vs. next-cycle billing | 1 day |
| [03-Dunning-and-Failed-Renewals.md](03-Dunning-and-Failed-Renewals.md) | Why renewals fail, provider built-in retry logic (heavily hedged), and app-level dunning emails/grace periods | 1 day |

## Estimated Time

3 days

## Next Phase

→ [Phase 7: Refunds, Disputes, and Chargebacks](../Phase-07-Refunds-Disputes-and-Chargebacks/README.md)
