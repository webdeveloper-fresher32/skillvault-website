# Minor Units and Currency Handling

Phase 3 flagged that Stripe expects amounts in cents, not dollars, and Phase 4 flagged that Razorpay expects paise, not rupees. Both are instances of one general rule defined by the ISO 4217 currency standard: every currency has a fixed number of minor-unit decimal places, and the amount you send an API is always an integer in that minor unit. The rule everyone reaches for — "multiply by 100" — happens to be correct for USD, EUR, and INR, but it is not universal, and currencies that break it are well-documented, stable facts rather than edge cases you need to guess at.

## 1. The General Rule (Multiply by 10^decimal-places)

Every ISO 4217 currency code has a defined number of decimal places (also called its "exponent"). To convert a decimal amount in that currency to the integer minor-unit value an API expects, multiply by 10 raised to that currency's decimal-place count — not by a fixed 100. For a 2-decimal currency, 10^2 = 100, which is where "multiply by 100" comes from; it's a special case of the general rule, not the rule itself.

```js
function toMinorUnits(amount, decimalPlaces) {
  const factor = Math.pow(10, decimalPlaces);
  // Round to avoid floating-point artifacts (e.g. 19.99 * 100 = 1998.9999999999998)
  return Math.round(amount * factor);
}

module.exports = { toMinorUnits };
```

Run against five real currencies:

```js
const cases = [
  { currency: 'USD', decimalPlaces: 2, amount: 20.00 },
  { currency: 'JPY', decimalPlaces: 0, amount: 500 },
  { currency: 'BHD', decimalPlaces: 3, amount: 1.500 },
  { currency: 'EUR', decimalPlaces: 2, amount: 19.99 },
  { currency: 'KWD', decimalPlaces: 3, amount: 2.750 },
];

for (const c of cases) {
  const minor = toMinorUnits(c.amount, c.decimalPlaces);
  console.log(`${c.currency}: amount=${c.amount} decimalPlaces=${c.decimalPlaces} -> minorUnits=${minor}`);
}
```

Actual output, captured by running this with `node`:

```
USD: amount=20 decimalPlaces=2 -> minorUnits=2000
JPY: amount=500 decimalPlaces=0 -> minorUnits=500
BHD: amount=1.5 decimalPlaces=3 -> minorUnits=1500
EUR: amount=19.99 decimalPlaces=2 -> minorUnits=1999
KWD: amount=2.75 decimalPlaces=3 -> minorUnits=2750
```

Note the `Math.round` call: `19.99 * 100` alone produces `1998.9999999999998` in JavaScript floating-point arithmetic, not `1999`. Rounding after multiplying is required for any currency, not just the unusual ones — this is a general floating-point hazard, not something specific to 0- or 3-decimal currencies.

## 2. Zero-Decimal Currencies

The Japanese Yen (JPY) has zero decimal places — there is no sub-unit smaller than 1 yen in ordinary use. This is one of the most well-established facts in currency handling; Stripe's own documentation, for instance, explicitly lists JPY among its "zero-decimal currencies," where the amount sent to the API is the same integer as the whole-yen amount, with no multiplication at all. For JPY, `decimalPlaces` is `0`, so `Math.pow(10, 0)` is `1`, and `toMinorUnits(500, 0)` correctly returns `500` — not `50000`. A handful of other currencies (for example the Korean Won, KRW) are also commonly listed as zero-decimal by payment providers; if you're integrating a new zero-decimal currency, confirm it against your specific provider's currency-support documentation rather than assuming JPY's behavior generalizes to every currency that "looks similar."

## 3. Three-Decimal Currencies (the Rare Case)

A small number of currencies use three decimal places instead of two. The Bahraini Dinar (BHD) and Kuwaiti Dinar (KWD) are commonly cited, well-documented examples — both subdivide into 1,000ths (BHD into fils, KWD into fils), so `decimalPlaces` is `3` and the multiplier is 1,000, not 100. A charge of BHD 1.500 becomes `1500` minor units, not `150`. These currencies are genuinely rare in mainstream payment integrations (most checkout flows never encounter one), so the practical lesson is less "memorize the list" and more "never assume — look up the currency's actual decimal-place count before shipping support for it," exactly as you would for any currency you haven't handled before.

## Comparison

| Aspect | Stripe (Phase 3) | Razorpay (Phase 4) | PayPal (Phase 5) |
|---|---|---|---|
| Amount representation | Integer in the currency's smallest unit (e.g. cents for USD) | Integer in the currency's smallest unit (paise for INR) | Decimal string in the Orders v2 API (e.g. `"20.00"`), not an integer minor-unit count |
| 2-decimal currency example | `2000` for $20.00 USD | `200000` for ₹2,000.00 INR | `"20.00"` for $20.00 USD |
| Zero-decimal currency handling | JPY sent as-is, no multiplication (documented "zero-decimal currency") | Not commonly used for INR-focused integrations; same ISO 4217 principle applies if supported | `"500"` (or `"500.00"` depending on the field) — hedge on exact formatting per PayPal's current docs |
| Practical takeaway | Look up each currency's decimal-place count via Stripe's currency docs before assuming ×100 | Same principle; less commonly hit in an India-focused integration since INR is 2-decimal | Because the Orders v2 API already takes a decimal string, the minor-unit multiplication step doesn't apply the same way — but you must still know the currency's correct decimal precision for display and rounding |

This table reflects the general, conceptual shape of how each provider represents amounts as documented at the time of Phases 3–5; always confirm exact field names, formats, and currently supported currencies against each provider's live API reference before shipping.

## Common Mistakes

- Hardcoding "multiply by 100" as a universal rule across all currencies — it silently overcharges by 100x for a zero-decimal currency like JPY (sending `50000` instead of `500` charges ¥50,000 instead of ¥500) and undercharges by 10x for a three-decimal currency (sending `150` instead of `1500` for BHD 1.500).
- Not looking up a currency's actual ISO 4217 decimal-place count before shipping support for a new market — assuming every new currency behaves like the ones you've already integrated.
- Multiplying without rounding, letting floating-point arithmetic (e.g. `19.99 * 100`) produce a non-integer value that some APIs will reject or silently truncate.
- Assuming a provider's amount field is always an integer minor-unit count — as the comparison table shows, this isn't true of every provider's every API (PayPal's Orders v2 `value` field is a decimal string).

## Hands-On Exercises

1. **Run the conversion function against 5 currencies.** Using the `toMinorUnits` function above, compute the minor-unit value for: USD 20.00 (2 decimals), JPY 500 (0 decimals), BHD 1.500 (3 decimals), EUR 19.99 (2 decimals), and KWD 2.750 (3 decimals). Confirm your output matches the captured results in section 1.
2. **Verify two conversions by hand.** For USD 20.00 at 2 decimal places: 20.00 × 10² = 20.00 × 100 = 2000 — matches the captured output. For JPY 500 at 0 decimal places: 500 × 10⁰ = 500 × 1 = 500 — matches the captured output (no multiplication, since 10⁰ = 1).
3. **Find the bug.** A developer writes `amount: dollars * 100` and reuses this helper for a JPY charge of ¥500, producing `amount: 50000`. Explain in one or two sentences what the customer is actually charged, and why.
4. **Look up a currency you haven't seen before.** Pick any currency your team hasn't integrated (e.g. Icelandic Króna, Chilean Peso, or Jordanian Dinar), look up its ISO 4217 decimal-place count from a provider's currency-support documentation, and write down what multiplier `toMinorUnits` would apply for it.
5. **Extend the function for display.** Write a companion function `fromMinorUnits(minorAmount, decimalPlaces)` that reverses `toMinorUnits`, and confirm it correctly turns `2000` back into `20` for a 2-decimal currency and `500` back into `500` for a 0-decimal currency.

## Interview Q&A

**Q: Why does "multiply by 100" break for some currencies?**
A: Because the correct multiplier is 10 raised to that currency's ISO 4217 decimal-place count, and not every currency has 2 decimal places — 100 (10²) is only correct for 2-decimal currencies like USD or INR; a 0-decimal currency like JPY needs a multiplier of 1, and a 3-decimal currency like BHD needs 1,000.

**Q: What happens if you charge a JPY amount using a ×100 assumption?**
A: You overcharge the customer by a factor of 100 — sending `50000` instead of `500` for a ¥500 purchase results in a ¥50,000 charge, since JPY has zero minor-unit decimal places and the API expects the whole-yen amount unmodified.

**Q: Name a currency with three minor-unit decimal places and explain the practical impact.**
A: The Bahraini Dinar (BHD) is a well-documented example — it subdivides into 1,000 fils, so amounts must be multiplied by 1,000 rather than 100. Using the standard ×100 assumption for BHD would undercharge by a factor of 10 (e.g. sending `150` instead of `1500` for BHD 1.500).

**Q: Why is `Math.round` necessary even for an ordinary 2-decimal currency like EUR?**
A: Floating-point multiplication can introduce rounding artifacts — `19.99 * 100` evaluates to `1998.9999999999998` in JavaScript rather than exactly `1999` — so the result must be rounded to the nearest integer before being sent to a payment API that expects an exact integer minor-unit value.

**Q: Does every payment provider represent amounts as an integer in the currency's minor unit?**
A: Not universally — Stripe and Razorpay do, but PayPal's Orders v2 API takes the amount as a decimal string (e.g. `"20.00"`) rather than an integer count of minor units, so the exact representation still needs to be confirmed per provider even though the underlying ISO 4217 decimal-place concept applies everywhere.
