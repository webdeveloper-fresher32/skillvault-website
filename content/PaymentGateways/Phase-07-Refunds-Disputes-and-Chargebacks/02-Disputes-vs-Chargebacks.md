# Disputes vs. Chargebacks

"Dispute" and "chargeback" get used interchangeably in casual conversation, but they describe two different mechanisms with different merchant recourse, and conflating them in application logic (or in a support team's mental model) leads to mishandling the cases where recourse actually matters.

## 1. Disputes vs. Chargebacks — the Practical Difference

A **dispute** is provider-mediated: the customer contacts the payment provider (or the provider learns of it through the card network), the provider notifies the merchant, and — critically — the merchant gets a structured chance to respond with evidence before the case is resolved. A **chargeback** is bank-initiated: the customer's bank reverses the charge directly through the card network's chargeback process, and merchant recourse in that path is often more limited and more procedural than a provider's own dispute flow. In everyday usage the terms overlap heavily — a card-network chargeback is frequently what a provider's dashboard displays and calls a "dispute" — but the practical distinction that matters for your application is whether you have a structured evidence-submission opportunity before the case resolves, or whether the reversal has effectively already happened through the bank's own process.

```text
DISPUTE (provider-mediated)                    CHARGEBACK (bank-initiated)
Customer contacts provider/bank                Customer's bank reverses the charge
        |                                               directly via the card network
        v                                                       |
Provider notifies merchant                                      v
        |                                        Merchant recourse is typically more
        v                                        limited and more procedural than a
Merchant gets a window to submit evidence        provider-mediated dispute flow
        |
        v
Provider resolves in merchant's or
customer's favor
```

## 2. The Dispute Lifecycle (Opened → Evidence Window → Resolved)

Every provider models roughly the same shape for a dispute's lifecycle: it opens, the merchant gets a time-boxed window to submit evidence, and it resolves one way or the other. The length of that evidence window is not a fixed universal fact — it's commonly described as a limited window, on the order of days to a couple of weeks depending on the provider and the underlying card network, but the exact current number for any given provider/network combination should be verified against that provider's current docs rather than assumed from this lesson.

```text
Dispute OPENED
      |
      v
Merchant notified (typically via webhook + dashboard)
      |
      v
+---------------------------------------------------------+
| EVIDENCE WINDOW                                          |
| A limited window - commonly on the order of days to a    |
| couple weeks depending on provider and card network.      |
| Verify current specifics with the provider before relying |
| on any exact number.                                       |
+---------------------------------------------------------+
      |
      v
Merchant submits evidence, OR window closes with no response
      |
      v
Dispute RESOLVED
      |
      +--> WON (merchant keeps the funds)
      |
      +--> LOST (funds stay reversed to the customer, dispute fee may apply)
```

## 3. Financial Impact (Dispute Fees)

Providers typically charge a dispute fee when a dispute is opened, separate from the disputed transaction amount itself — and that fee's handling (whether it's refunded if the merchant wins, whether it's charged regardless of outcome) varies by provider and can change over time. Do not treat any specific dollar figure or fee-refund policy in this lesson as current fact for any provider — verify the exact fee amount and whether it's refundable on a win against that provider's current pricing/docs before relying on it for financial planning. What's safe to assert generically: disputes carry a real cost to the merchant beyond the disputed amount itself, which is one more reason evidence quality and response speed matter even in cases the merchant expects to win.

## Comparison

| Aspect | Stripe (conceptual) | Razorpay (conceptual) | PayPal (conceptual) |
|---|---|---|---|
| Provider's term for the provider-mediated case | Typically surfaced as a "dispute" in the dashboard/API | Typically surfaced as a "dispute" in the dashboard/API | Typically surfaced as a "dispute" (and sometimes distinguished from an escalated "claim") in the dashboard/API |
| Evidence submission window | Exists, time-boxed — verify current exact length in Stripe's docs | Exists, time-boxed — verify current exact length in Razorpay's docs | Exists, time-boxed — verify current exact length in PayPal's docs |
| Dispute fee on open | Typically charged — verify current amount and refund-on-win policy in Stripe's docs | Typically charged/applicable — verify current amount and policy in Razorpay's docs | Typically charged/applicable — verify current amount and policy in PayPal's docs |
| Bank-initiated chargeback recourse | Generally more limited/procedural than the provider's own mediated dispute flow, since the reversal path runs through the card network rather than the provider's dispute process | Same general pattern | Same general pattern |
| Webhook event marking the case opened | `charge.dispute.created` (verified in Phase 3's event table) | A dispute/chargeback-opened event exists conceptually — verify current exact event name in Razorpay's docs | A dispute/chargeback-opened event exists conceptually — verify current exact event name in PayPal's docs |

## Common Mistakes

- Missing the evidence-submission deadline — an unanswered dispute is typically auto-resolved in the customer's favor once the evidence window closes, so treating the deadline as a soft suggestion rather than a hard cutoff can lose a case the merchant otherwise had good evidence to win.
- Conflating "dispute" and "refund" in application logic — a refund is something the merchant initiates voluntarily, while a dispute is initiated by the customer/bank and puts the case outside the merchant's unilateral control until it resolves. Code (or a database schema) that treats both as the same "money going back" event loses the distinction between "we chose to give this back" and "we're contesting whether this should be given back."
- Assuming a specific evidence-window length (a specific number of days) is a fixed, universal fact across providers and card networks, and hardcoding logic or internal deadlines against it without verifying the current figure for the specific provider/network combination in play.
- Treating every dispute as unwinnable and not bothering to submit evidence, when providers do resolve some fraction of well-evidenced disputes in the merchant's favor — skipping evidence submission by default forfeits cases that were otherwise winnable.
- Not accounting for the dispute fee as a real cost separate from the disputed amount when reasoning about whether contesting a low-value dispute is worth the effort.

## Hands-On Exercises

1. **Paper exercise: classify five scenarios.** For each of the following, decide whether it best fits the "dispute" (provider-mediated, evidence window) model or the "chargeback" (bank-initiated) model, and justify your answer in one sentence: (a) a customer emails your support team asking for their money back — (b) a customer calls their card issuer directly, and your payment provider's dashboard shows a new case with an evidence deadline — (c) a customer's bank reverses a transaction and your provider's dashboard shows it with materially less opportunity to submit evidence than a typical case — (d) your support team proactively refunds an order before the customer complains — (e) a `charge.dispute.created` webhook fires. (Expected reasoning: (a) is neither by itself — it's a support request that could become a refund if you act, or a dispute/chargeback if the customer escalates instead; (b) and (e) fit the provider-mediated dispute model, since there's a structured evidence window; (c) fits the bank-initiated chargeback model, given the more limited recourse; (d) is a refund, not a dispute or chargeback, since the merchant initiated it voluntarily with no customer escalation involved.)
2. **Design a database schema field (paper exercise).** Sketch an `orders` table (or a related `order_events` table) with a status field that distinguishes at least these states: `paid`, `refunded`, `disputed`, `dispute_won`, `dispute_lost`. For each state, write one sentence on what UI the customer should see and one sentence on what internal notification (support team, finance team, or both) should fire when the order enters that state.
3. **Trace the evidence-window failure mode.** Using the lifecycle diagram in section 2, write out what happens to a dispute if the merchant never submits evidence and the window closes — which side does it resolve in favor of, and what does that imply about treating the evidence deadline as optional?
4. **Fee reasoning (paper exercise).** Given that a dispute fee is charged separately from the disputed amount (per section 3, without pinning down an exact figure), write one or two sentences reasoning about why a merchant might still choose to contest a small-dollar dispute even though contesting costs staff time, versus a case where letting it go might be more economical — this is a judgment exercise, not a numeric one.
5. **Distinguish two webhook-driven code paths.** Sketch (as pseudocode, not runnable code) two separate handler branches in a webhook processor: one triggered by a refund-related event (from Lesson 1) and one triggered by a dispute-opened event (`charge.dispute.created`), and write one sentence per branch on what each should update in the `orders` table from Exercise 2 — confirm the two branches update different status values and never collapse into the same code path.

## Interview Q&A

**Q: What's the practical difference between a dispute and a chargeback?**
A: A dispute is provider-mediated — the customer contacts the provider or bank, the provider notifies the merchant, and the merchant gets a structured window to submit evidence before resolution. A chargeback is bank-initiated — the customer's bank reverses the charge directly through the card network, typically with more limited and more procedural merchant recourse than a provider's own dispute flow.

**Q: What happens if a merchant never responds to a dispute within the evidence window?**
A: It's typically auto-resolved in the customer's favor — the merchant loses the disputed amount (and the dispute fee, subject to that provider's policy) by default, simply by missing the deadline, regardless of whether the underlying evidence would have won the case.

**Q: Why shouldn't "dispute" and "refund" be modeled as the same event in application logic?**
A: A refund is voluntarily initiated by the merchant; a dispute is initiated by the customer/bank and takes the case outside the merchant's unilateral control until it resolves. Collapsing them into one status loses the distinction between "we chose to return this money" and "we're contesting whether this money should be returned," which affects what UI and notifications should fire.

**Q: Is it safe to assume every provider gives the merchant exactly the same number of days to respond to a dispute?**
A: No — evidence-window length varies by provider and card network and can change over time; it's commonly on the order of days to a couple of weeks, but the exact current figure needs to be verified against the specific provider's docs rather than assumed as a fixed universal number.

**Q: Does losing a dispute only cost the merchant the disputed amount?**
A: Typically no — providers commonly charge a separate dispute fee on top of the disputed amount, and whether that fee is refunded if the merchant wins varies by provider; the exact amount and policy should be checked against current provider documentation rather than assumed.
