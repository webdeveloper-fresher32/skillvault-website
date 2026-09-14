# Payment Gateways Course — Design Spec

Date: 2026-07-31

## Purpose

Add a new SkillVault course, `PaymentGateways/`, covering payment integration for the three most commonly used gateways in real-world applications: Stripe, Razorpay, and PayPal. Framed for both practical integration work and technical interview prep. Unified into a single course (per user decision) rather than three separate provider-specific courses, since the underlying concepts (checkout flows, webhooks, idempotency, PCI scope) are identical across providers and teaching them once avoids triple repetition.

## Scope

10 phases:

- Phases 1–2: provider-agnostic fundamentals (payment flow shape, webhooks/event processing) taught once
- Phases 3–5: one integration phase per provider (Stripe, Razorpay, PayPal), each staying short by referencing back to Phases 1–2 rather than re-teaching shared concepts
- Phases 6–9: cross-cutting concerns that apply across all three providers but differ in provider-specific detail (recurring payments, refunds/disputes, security/compliance, multi-currency/international)
- Phase 10: provider comparison, production best practices, and interview-prep capstone

## Course Structure

```
PaymentGateways/
├── Phase-01-Payment-Fundamentals/
├── Phase-02-Webhooks-and-Event-Processing/
├── Phase-03-Stripe-Integration/
├── Phase-04-Razorpay-Integration/
├── Phase-05-PayPal-Integration/
├── Phase-06-Recurring-Payments-and-Subscriptions/
├── Phase-07-Refunds-Disputes-and-Chargebacks/
├── Phase-08-Security-and-Compliance/
├── Phase-09-Multi-Currency-and-International-Payments/
├── Phase-10-Choosing-Providers-and-Production-Best-Practices/
├── Projects/
├── Quick-Reference/
└── README.md
```

Per-phase `README.md` is KEPT (standard convention, same as every course except DSA's deliberate exception and matching GithubActions' choice).

## Phase Topic Breakdown

1. **Payment Fundamentals** — the checkout flow shape shared across providers (create a payment/order object server-side → collect payment method client-side → confirm/capture → handle result), PCI DSS scope reduction via hosted fields/redirect checkout (never touching raw card numbers), test/sandbox mode conventions, idempotency keys for safe retries on network failure
2. **Webhooks and Event Processing** — why webhooks exist (the client-side confirmation isn't authoritative — the server must trust the async webhook), signature verification (HMAC-based, provider-specific header/secret schemes), at-least-once delivery and why handlers must be idempotent, common event types (payment succeeded/failed, refund issued, dispute opened)
3. **Stripe Integration** — Payment Intents API and Checkout Sessions, Stripe Elements for hosted card fields, the `stripe-node` SDK, mapping Stripe's specific webhook event names/signature scheme onto Phase 2's general model
4. **Razorpay Integration** — Orders API, Razorpay Checkout (client-side widget), the specific HMAC signature verification Razorpay requires client-side AND server-side (a Razorpay-specific nuance not present in Stripe/PayPal), the `razorpay` Node SDK
5. **PayPal Integration** — Orders API v2 (create → approve → capture), PayPal Smart Buttons, OAuth2 client-credentials token flow for server-side API calls (a PayPal-specific nuance), the `@paypal/checkout-server-sdk`
6. **Recurring Payments and Subscriptions** — subscription lifecycle (trial → active → past-due → canceled), proration on plan changes, dunning (retrying failed renewal charges), how each of the three providers models this (Stripe Subscriptions, Razorpay Subscriptions, PayPal Billing Plans/Subscriptions)
7. **Refunds, Disputes, and Chargebacks** — full vs. partial refunds, the dispute/chargeback lifecycle (a chargeback is bank-initiated and different from a provider-mediated dispute), evidence submission, how refund/dispute webhooks fit into Phase 2's event model
8. **Security and Compliance** — PCI DSS compliance levels and how hosted-checkout approaches minimize scope (tying back to Phase 1), card tokenization, 3D Secure/SCA (Strong Customer Authentication, relevant for EU/UK per PSD2), basic fraud-signal awareness (velocity checks, AVS/CVV mismatch)
9. **Multi-Currency and International Payments** — currency handling (minor units/smallest-currency-unit gotchas — cents vs. whole-currency amounts), regional provider availability and why Razorpay dominates India while Stripe/PayPal are global-first, settlement currency vs. presentment currency
10. **Choosing Providers and Production Best Practices** — a Stripe vs. Razorpay vs. PayPal comparison (fees, supported countries/currencies, feature parity, developer experience), testing strategies (sandbox environments, webhook testing tools like Stripe CLI), monitoring failed payments/webhook delivery, an interview-strategy capstone

## Lesson Format

Every lesson file uses the topic-headed style (matching `Networking/`, `AWS/`, and the reformatted `GithubActions/` course) — chosen from the start this time, per explicit user decision, to avoid the reformat redo that GithubActions required:

```markdown
# <Topic>

(1 short paragraph, 2-4 sentences — what this is and why it matters)

## 1. <Topic-named section>
(short prose, 2-5 sentences) → immediately followed by a code snippet, diagram, or table

## 2-N. <as many topic-named sections as the concept needs>

## Comparison
(STANDALONE heading, ALWAYS present — a table comparing 2+ things, e.g. providers, approaches, or concepts covered in this lesson)

## Common Mistakes
(3-5 concrete bullets)

## Hands-On Exercises
(3-5 runnable exercises — real Node.js/CLI commands against sandbox/test-mode credentials, or concrete "build this and observe X" steps; sanity-checked for logical self-consistency)

## Interview Q&A
(3-5 short, direct Q&A pairs — no narration)
```

Code examples are Node.js throughout (per user decision), using each provider's official SDK where relevant (`stripe`, `razorpay`, `@paypal/checkout-server-sdk`). Every code/JSON example must be well-formed (validated by actually parsing/running where feasible — e.g. JSON payloads validated with `JSON.parse`, and any genuinely executable Node.js snippet, such as signature-verification logic, actually run and confirmed) — same discipline established in the DSA and GithubActions courses.

## Projects/ Folder

End-to-end builds combining multiple phases:
- A single checkout-flow abstraction that supports all three providers behind one interface (combines Phases 1, 3, 4, 5)
- A subscription billing system with dunning logic (combines Phase 6)
- A refund/dispute handling pipeline driven by webhooks (combines Phases 2, 7)

## Quick-Reference/ Folder

- `Cheatsheet.md` — dense reference: webhook signature-verification snippets per provider, common API endpoints, currency minor-unit table, HTTP status code conventions per provider.
- `Interview-QA.md` — 50 interview questions with answers, matching the convention used in other courses.

## Course-level README.md

Standard convention: course overview, what it covers and why, Phase | Topic | Difficulty | Time learning path table (10 rows + Projects row), link into Phase 1's README.

## Out of Scope

- No cloud-provider-specific deployment content (that's covered by existing AWS/Docker/Kubernetes courses) — this course is about the payment integration layer itself, not hosting it.
- Not a legal/compliance deep-dive — Phase 8 covers PCI DSS and SCA at the developer-integration level (what changes in your code), not as legal guidance.
- No cryptocurrency/blockchain payment rails — scope is limited to the three named traditional payment gateways.

## Open Questions

None — all scoping decisions made during brainstorming (single unified course, Node.js, topic-headed lesson format from the start).
