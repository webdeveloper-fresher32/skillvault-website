# Phase 7: Refunds, Disputes, and Chargebacks

## What You'll Learn

Handle money moving backwards: issue full and partial refunds without accidentally letting a bug refund more than a customer paid, understand how a provider-mediated dispute differs from a bank-initiated chargeback, and model a dispute's lifecycle from its opening webhook through to a won/lost resolution using the same webhook-authority model Phase 2 established for payments.

## Learning Objectives

- Issue full and partial refunds correctly, with server-side cumulative tracking that rejects any refund attempt exceeding the original charge
- Distinguish a provider-mediated dispute from a bank-initiated chargeback, and understand the time-boxed evidence window between a dispute opening and its resolution
- Model an application's internal dispute state (`needs_response` → `under_review` → `won`/`lost`) driven entirely by incoming webhook events, consistent with Phase 2's "webhook is the authority" model

## Topics

| File | Topic | Time |
|------|-------|------|
| [01-Full-and-Partial-Refunds.md](01-Full-and-Partial-Refunds.md) | Full vs. partial refunds, why refunds aren't instant to the customer, and confirming a refund via webhook rather than trusting the API's 200 response | 1 day |
| [02-Disputes-vs-Chargebacks.md](02-Disputes-vs-Chargebacks.md) | The practical difference between a dispute and a chargeback, the dispute lifecycle and its evidence window, and dispute fees (hedged) | 1 day |
| [03-Evidence-Submission-and-Webhook-Events.md](03-Evidence-Submission-and-Webhook-Events.md) | What counts as evidence, submitting it programmatically vs. via dashboard, and tracking dispute state from webhook events | 1 day |

## Estimated Time

3 days

## Next Phase

→ [Phase 8: Security and Compliance](../Phase-08-Security-and-Compliance/README.md)
