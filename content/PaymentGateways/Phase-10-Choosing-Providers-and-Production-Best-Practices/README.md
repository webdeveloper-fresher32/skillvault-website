# Phase 10: Choosing Providers and Production Best Practices

## What You'll Learn

This is the final phase of the course — a capstone that synthesizes Phases 1 through 9 into a single decision framework, a pre-production testing strategy, and a production monitoring/interview-readiness playbook. Nothing new about any single provider is introduced here; every claim in this phase is traced back to the specific earlier lesson that established it.

## Learning Objectives

- Choose a payment provider, or a combination of providers, using a structured framework that weighs fee shape, regional fit, and feature/integration-complexity differences established in Phases 1–9, rather than fees alone
- Design a thorough pre-production test matrix covering test cards, local webhook testing, and the scenarios most commonly skipped (decline paths, 3DS challenges, webhook re-delivery, refunds)
- Monitor payment and webhook health in production, build a reconciliation job as a safety net for lost webhooks, and structure a strong, shape-first answer to a payment-integration interview question

## Topics

| File | Topic | Time |
|------|-------|------|
| [01-Stripe-vs-Razorpay-vs-PayPal-Comparison.md](01-Stripe-vs-Razorpay-vs-PayPal-Comparison.md) | Fee structure shape, developer experience and SDK quality, and a feature-parity recap across subscriptions, disputes, and 3DS — synthesizing Phases 3–9 into one comprehensive comparison table | 1 day |
| [02-Testing-Strategies-and-Sandbox-Tools.md](02-Testing-Strategies-and-Sandbox-Tools.md) | Test cards for simulating success/decline/3DS outcomes, local webhook testing via provider CLI vs. general-purpose tunneling, and a suggested test matrix covering happy path, decline, 3DS, webhook retry, and refund | 1 day |
| [03-Monitoring-and-Interview-Capstone.md](03-Monitoring-and-Interview-Capstone.md) | Monitoring webhook delivery health, reconciliation jobs as a safety net for lost webhooks, and an interview framework for structuring a shape-first answer to payment-integration questions | 1 day |

## Estimated Time

3 days

## Next Phase

→ [Projects](../Projects/README.md)
