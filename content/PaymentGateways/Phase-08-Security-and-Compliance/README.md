# Phase 8: Security and Compliance

## What You'll Learn

Separate two axes of PCI compliance that are easy to conflate — merchant Level (volume-based) versus SAQ type (architecture-based) — understand how tokenization lets a saved card be reused later without your server ever storing raw card data, and finally explain the extra authentication redirect Phase 3 flagged but didn't name: 3D Secure, required for Strong Customer Authentication under PSD2.

## Learning Objectives

- Distinguish a PCI compliance Level (1-4, volume-based, network-assigned) from a SAQ type (A/A-EP/D, architecture-based, from Phase 1) — and recognize these are independent axes, not one thing
- Understand tokenization's role in reusable/saved payment methods, and its practical consequence: tokens are provider-specific and not portable, so switching providers means re-collecting every customer's payment method
- Handle 3D Secure / SCA challenge flows — recognize the `requires_action`-style status across providers, redirect the customer through the challenge, and account for abandonment

## Topics

| File | Topic | Time |
|------|-------|------|
| [01-PCI-DSS-Compliance-Levels.md](01-PCI-DSS-Compliance-Levels.md) | Compliance Levels (volume-based) vs. SAQ type (architecture-based) as two different axes, and why hosted checkout keeps most apps at SAQ A regardless of Level | 1 day |
| [02-Tokenization.md](02-Tokenization.md) | How tokenization enables saved cards/reusable payment methods without storing raw card data, how it differs from hosted fields, and why tokens aren't portable across providers | 1 day |
| [03-3D-Secure-and-SCA.md](03-3D-Secure-and-SCA.md) | 3D Secure as an authentication redirect, SCA/PSD2 at a developer level, and handling the challenge step across Stripe/Razorpay/PayPal — closing the loop from Phase 3 | 1 day |

## Estimated Time

3 days

## Next Phase

→ [Phase 9: Multi-Currency and International Payments](../Phase-09-Multi-Currency-and-International-Payments/README.md)
