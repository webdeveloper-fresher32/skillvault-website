# Phase 9: Multi-Currency and International Payments

## What You'll Learn

Generalize the "cents vs. paise" gotcha from Phase 3 (Stripe) and Phase 4 (Razorpay) into the real underlying rule — every currency has an ISO 4217-defined number of minor-unit decimal places, and it isn't always 2 — then step back to the business-level questions that come with going international: which provider actually serves which market well, and what currency really lands in your bank account after a cross-border charge.

## Learning Objectives

- Convert a decimal amount to the correct minor-unit integer for any currency, including zero-decimal currencies (e.g. JPY) and three-decimal currencies (e.g. Bahraini Dinar), without hardcoding "multiply by 100"
- Reason about provider choice by target market — recognizing that Razorpay's depth on India-specific payment methods and Stripe/PayPal's broader global reach reflect different market strengths, not a universal "better" provider
- Distinguish presentment currency (what the customer is charged in) from settlement currency (what actually arrives in the merchant's payout account), and account for currency-conversion fees between the two

## Topics

| File | Topic | Time |
|------|-------|------|
| [01-Minor-Units-and-Currency-Handling.md](01-Minor-Units-and-Currency-Handling.md) | The general "multiply by 10^decimal-places" rule, zero-decimal currencies like JPY, and rare three-decimal currencies — closing the loop from Phase 3/4's cents/paise gotcha | 1 day |
| [02-Regional-Provider-Availability.md](02-Regional-Provider-Availability.md) | Why provider choice is market-dependent — Razorpay's strength on India-specific payment methods (UPI and more) versus Stripe/PayPal's broader global reach | 1 day |
| [03-Settlement-vs-Presentment-Currency.md](03-Settlement-vs-Presentment-Currency.md) | Presentment currency vs. settlement currency, currency-conversion fees, and multi-currency payout accounts | 1 day |

## Estimated Time

3 days

## Next Phase

→ [Phase 10: Choosing Providers and Production Best Practices](../Phase-10-Choosing-Providers-and-Production-Best-Practices/README.md)
