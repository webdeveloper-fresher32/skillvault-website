# Payment Gateways — Complete Learning Course

Master payment integration from provider-agnostic fundamentals through Stripe, Razorpay, and PayPal specifics to production-grade security, compliance, and multi-currency handling. This course covers everything from the shape of a checkout flow and webhook mechanics through subscription billing, refunds/disputes, and choosing the right provider — framed for practical integration work and payments-focused interview prep.

---

## Overview

Payment gateways look different on the surface — Stripe's Payment Intents, Razorpay's Orders API, PayPal's OAuth2 flows — but underneath they share the same building blocks: a checkout flow that moves money without your server ever touching raw card data, webhooks that reliably notify you of asynchronous state changes, idempotency keys that make retries safe, and signature verification that keeps those webhooks trustworthy. This course starts from those provider-agnostic fundamentals (PCI scope, hosted fields, test mode, at-least-once delivery) before going deep on the three most widely used providers — Stripe, Razorpay, and PayPal — each covered through its checkout API, client-side integration, and webhook handling in practice. The back half of the course is production-focused: recurring billing and dunning, refunds/disputes/chargebacks, PCI DSS compliance levels and tokenization, 3D Secure/SCA, multi-currency and settlement handling, and a final phase on choosing between providers, testing strategies, monitoring, and an interview-strategy capstone.

---

## Course Structure

```
PaymentGateways/
├── Phase-01-Payment-Fundamentals/                          → checkout flow shape, PCI scope & hosted fields, test mode & idempotency keys
├── Phase-02-Webhooks-and-Event-Processing/                 → why webhooks exist, signature verification, at-least-once delivery & idempotent handlers
├── Phase-03-Stripe-Integration/                            → Payment Intents & Checkout Sessions, Stripe Elements, Stripe webhooks in practice
├── Phase-04-Razorpay-Integration/                          → Orders API & Razorpay Checkout, client/server signature verification, Razorpay webhooks in practice
├── Phase-05-PayPal-Integration/                            → OAuth2 client credentials flow, Orders API v2 (create/approve/capture), PayPal webhooks in practice
├── Phase-06-Recurring-Payments-and-Subscriptions/          → subscription lifecycle, proration & plan changes, dunning & failed renewals
├── Phase-07-Refunds-Disputes-and-Chargebacks/              → full & partial refunds, disputes vs chargebacks, evidence submission & webhook events
├── Phase-08-Security-and-Compliance/                       → PCI DSS compliance levels, tokenization, 3D Secure & SCA
├── Phase-09-Multi-Currency-and-International-Payments/     → minor units & currency handling, regional provider availability, settlement vs presentment currency
├── Phase-10-Choosing-Providers-and-Production-Best-Practices/ → Stripe vs Razorpay vs PayPal comparison, testing strategies & sandbox tools, monitoring & interview capstone
├── Projects/                                                → End-to-end integrations combining multiple phases' patterns
└── Quick-Reference/                                         → Cheatsheet + Interview Q&A
```

Every phase directory has its own `README.md` summarising that phase's lessons, plus numbered lesson files (`01-...md`, `02-...md`, etc.) — the same pattern used by the Docker, Kubernetes, MongoDB, MySQL, HLD, and GitHub Actions courses in this repo.

---

## Learning Path

| Phase | Topic | Difficulty | Time |
|-------|-------|-----------|------|
| 01 | Payment Fundamentals | Easy | 3 days |
| 02 | Webhooks and Event Processing | Easy | 3 days |
| 03 | Stripe Integration | Easy-Medium | 3 days |
| 04 | Razorpay Integration | Easy-Medium | 3 days |
| 05 | PayPal Integration | Easy-Medium | 3 days |
| 06 | Recurring Payments and Subscriptions | Medium | 3 days |
| 07 | Refunds, Disputes and Chargebacks | Medium | 3 days |
| 08 | Security and Compliance | Medium-Hard | 3 days |
| 09 | Multi-Currency and International Payments | Medium | 3 days |
| 10 | Choosing Providers and Production Best Practices | Hard | 3 days |
| Projects | End-to-end payment integrations (combines phases 1–7) | Medium-Hard | 4-6 days |

**Total estimated time: 5 weeks** (30 phase-days + 4-6 project-days ≈ 34-36 days)

---

## Prerequisites

- Basic Node.js/JavaScript familiarity is helpful — the course's code examples are JavaScript-based, but each concept is taught from scratch for the purposes of the integration at hand.
- Basic HTTP/REST API familiarity (requests, responses, status codes) is assumed at a basic level; webhook and API-specific concepts are taught from scratch within the course.
- No prior payments or PCI compliance experience required — Phase 1 builds these fundamentals from zero.

---

## Where to Start

Begin with [Phase-01-Payment-Fundamentals/README.md](Phase-01-Payment-Fundamentals/README.md).
