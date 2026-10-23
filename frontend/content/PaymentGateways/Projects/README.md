# Payment Gateways — Projects

Phases 1–10 each taught one slice of a payment integration in isolation: the checkout flow's shape, webhook trust, one provider's specifics, subscription billing, refunds and disputes. Real systems don't get to keep those slices separate — a production checkout has to unify three providers behind one interface, a billing system has to run the subscription state machine and the dunning schedule together, and a webhook endpoint has to handle refunds and disputes through the same idempotent pipeline. These three projects combine patterns from multiple phases into single, end-to-end builds, the way you'd actually have to wire them in a real codebase.

Every project follows the same structure: a problem statement, a discussion of the approach and why it's shaped that way, a solution with real Node.js code, and a trade-offs section that's honest about where combining patterns creates friction. Wherever a project's core logic is self-contained (no live credentials required), it was actually executed with `node` and the output shown is real, captured output — not a hypothetical. Anywhere a snippet requires a live provider account (an actual Stripe/Razorpay/PayPal API call), that's called out explicitly and syntax-checked with `node --check` instead.

## Projects

| File | Patterns Combined | Phases |
|---|---|---|
| [`01-Unified-Checkout-Interface.md`](./01-Unified-Checkout-Interface.md) | Phase 1's 3-step checkout shape + Phases 3/4/5's provider-specific create-order/create-PaymentIntent calls, unified behind one `createPayment({ provider, amount, currency })` interface | Phases 1, 3, 4, 5 |
| [`02-Subscription-Billing-System-with-Dunning.md`](./02-Subscription-Billing-System-with-Dunning.md) | Phase 6's subscription lifecycle state machine + Phase 6's dunning backoff-schedule logic, combined into one system tracing a subscription from trial through a failed renewal, dunning retries, and eventual cancellation | Phase 6 |
| [`03-Webhook-Driven-Refund-and-Dispute-Pipeline.md`](./03-Webhook-Driven-Refund-and-Dispute-Pipeline.md) | Phase 2's idempotent-handler dedup-by-event-ID pattern + Phase 7's refund tracking and dispute state tracking, combined into one webhook processing pipeline that stays correct under duplicate delivery | Phases 2, 7 |

## How to Use These Projects

Each project assumes you've already worked through the phases listed in its "Phases Combined" column — they reuse the exact function shapes, state names, and event names taught there rather than inventing new ones, so if a name looks unfamiliar, it's worth going back to the source lesson rather than assuming this project redefined it. Run the self-contained scripts yourself with `node` and compare your output against what's shown; where a snippet is illustrative-only (because it needs a live provider account), that limitation is called out in the same place the code appears.
