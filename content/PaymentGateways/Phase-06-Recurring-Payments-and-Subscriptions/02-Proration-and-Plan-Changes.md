# Proration and Plan Changes

When a customer upgrades or downgrades a subscription in the middle of a billing cycle, neither "charge them the full new price" nor "ignore the change until next cycle" is fair — the customer already paid for days they won't fully use on the old plan, and switching plans mid-stream shouldn't mean paying for the same days twice. Proration is the standard fix: crediting the unused portion of the old plan and charging only the used portion of the new one.

## 1. What Proration Solves

Picture a customer on a $10/month plan who upgrades to $20/month exactly halfway through their billing cycle. Without proration, they'd either get charged the full $20 on top of the $10 they already paid (double-paying for the same period), or they'd keep the $10 rate until the next renewal (the business undercharges for the upgraded service they're now using). Proration solves this by splitting the current cycle in two: the days already elapsed stay billed at the old rate, and the days remaining get valued at the new rate, with the difference settled as a single credit or charge.

```text
Billing cycle: 30 days, customer upgrades on day 15 (15 days remaining)

Day 1 -----------------|----------------- Day 30
        (old plan,     ^ upgrade          (new plan,
       already paid)  happens here        remaining days)

Proration settles the difference for the REMAINING 15 days only —
the first 15 days already paid for at the old rate are untouched.
```

## 2. The Proration Calculation

The core formula is a straightforward ratio: take the number of days remaining in the current cycle, divide by the total days in the cycle, and apply that fraction to both the old plan's price (to compute the unused credit) and the new plan's price (to compute the prorated new charge). The net amount to charge (or credit) the customer is the difference between the two.

```text
fractionRemaining = daysRemaining / totalDaysInCycle

unusedCredit      = oldPrice * fractionRemaining
newPlanCharge     = newPrice * fractionRemaining
netAmount         = newPlanCharge - unusedCredit
                    (positive = charge the customer, negative = credit the customer)
```

A real, runnable implementation, working in integer cents (as Phase 1 established, amounts should always be integers in the smallest currency unit):

```js
function computeProration({ oldPriceCents, newPriceCents, daysRemaining, totalDaysInCycle }) {
  if (totalDaysInCycle <= 0) throw new Error("totalDaysInCycle must be positive");
  if (daysRemaining < 0 || daysRemaining > totalDaysInCycle) {
    throw new Error("daysRemaining must be between 0 and totalDaysInCycle");
  }

  const fractionRemaining = daysRemaining / totalDaysInCycle;

  const unusedCreditCents = Math.round(oldPriceCents * fractionRemaining);
  const newPlanChargeCents = Math.round(newPriceCents * fractionRemaining);
  const netChargeCents = newPlanChargeCents - unusedCreditCents;

  return {
    fractionRemaining: Number(fractionRemaining.toFixed(4)),
    unusedCreditCents,
    newPlanChargeCents,
    netChargeCents,
    direction: netChargeCents >= 0 ? "charge customer" : "credit customer",
  };
}
```

Running it against three scenarios:

```js
console.log("Scenario 1: $10/mo -> $20/mo, 15 of 30 days remaining");
console.log(computeProration({ oldPriceCents: 1000, newPriceCents: 2000, daysRemaining: 15, totalDaysInCycle: 30 }));

console.log("\nScenario 2: $50/mo -> $20/mo, 10 of 30 days remaining");
console.log(computeProration({ oldPriceCents: 5000, newPriceCents: 2000, daysRemaining: 10, totalDaysInCycle: 30 }));

console.log("\nScenario 3: $120/yr -> $240/yr, 100 of 365 days remaining");
console.log(computeProration({ oldPriceCents: 12000, newPriceCents: 24000, daysRemaining: 100, totalDaysInCycle: 365 }));
```

Actual output from running this with `node`:

```text
Scenario 1: $10/mo -> $20/mo, 15 of 30 days remaining
{
  fractionRemaining: 0.5,
  unusedCreditCents: 500,
  newPlanChargeCents: 1000,
  netChargeCents: 500,
  direction: 'charge customer'
}

Scenario 2: $50/mo -> $20/mo, 10 of 30 days remaining
{
  fractionRemaining: 0.3333,
  unusedCreditCents: 1667,
  newPlanChargeCents: 667,
  netChargeCents: -1000,
  direction: 'credit customer'
}

Scenario 3: $120/yr -> $240/yr, 100 of 365 days remaining
{
  fractionRemaining: 0.274,
  unusedCreditCents: 3288,
  newPlanChargeCents: 6575,
  netChargeCents: 3287,
  direction: 'charge customer'
}
```

Manually verifying Scenario 1 by hand: 15 of 30 days remaining is exactly half the cycle (`fractionRemaining = 0.5`). Half of the old $10 plan is a $5 unused credit (`1000 * 0.5 = 500` cents). Half of the new $20 plan is a $10 charge for the remaining half-cycle (`2000 * 0.5 = 1000` cents). The net is `1000 - 500 = 500` cents, i.e. a $5.00 charge — which matches the function's output exactly, confirming the math.

## 3. Provider-Specific Proration Behavior (Immediate vs. Next-Cycle — Conceptual, Hedge on Exact Defaults)

Even though the underlying math above is a fairly universal concept, providers differ meaningfully in *when* and *how* they apply it, and these behaviors are configurable and can change over time — treat anything below as "typical behavior to expect," not a permanent default to hardcode logic against, and confirm current behavior against each provider's docs and your account's specific plan/subscription configuration before relying on it.

- **Stripe** typically supports prorating immediately at the moment of a plan change, generating an invoice item (or adjusting the upcoming invoice) for the difference — but this is configurable per API call, and whether it charges immediately or rolls into the next invoice may depend on the options you pass and your account's settings. Verify current behavior against Stripe's billing docs.
- **Razorpay** typically handles plan changes on subscriptions differently depending on whether the change is scheduled for immediate effect or for the next billing cycle, and the exact proration mechanics may vary by API version and account configuration — do not assume a specific default without checking current docs.
- **PayPal** typically ties plan changes to its Billing Plan model, and whether a change prorates immediately or takes effect at the next cycle can depend on how the subscription revision is requested — again, verify against current PayPal docs rather than assuming a fixed default.

The one thing safe to assert across all three: none of them can be assumed to behave identically, and "immediate proration" vs. "change takes effect next cycle" is a real, meaningful axis of difference an integration must explicitly account for — not an implementation detail you can ignore because "they're all subscriptions."

## Comparison

| Aspect | Stripe | Razorpay | PayPal |
|---|---|---|---|
| Prorates mid-cycle plan changes | Typically supported, often configurable per request | Typically supported for subscriptions, behavior may depend on configuration/API version | Typically tied to Billing Plan/subscription revision behavior, may vary by configuration |
| Immediate charge vs. next-cycle | May vary by the options passed and account configuration — verify current docs | May vary by how the change is requested — verify current docs | May vary by how the revision is requested — verify current docs |
| Where proration line items appear | Typically as invoice items on the current or next invoice, subject to configuration | Typically reflected in the subscription's billing records, subject to configuration | Typically reflected in the subscription's billing cycle records, subject to configuration |
| Safe assumption for integrators | The underlying days-remaining/total-days math is a reasonable mental model; exact timing/invoicing behavior must be confirmed per account/API version | Same | Same |

## Common Mistakes

- Prorating based on raw calendar days without anchoring to the actual billing cycle's start and end dates — for example, using "days until the end of the calendar month" instead of "days until this subscription's actual renewal date" produces an off-by-some-days error whenever the cycle doesn't align with calendar month boundaries.
- Assuming all three providers prorate identically (same timing, same invoicing behavior) — their APIs differ meaningfully in when and how proration is applied, and code that hardcodes one provider's behavior while treating a second provider as a drop-in replacement will silently produce the wrong bill.
- Recomputing `daysRemaining` from "today" instead of from the subscription's actual current-period-end field returned by the provider — clock skew or a delayed webhook can make a naive "days between now and my locally stored renewal date" calculation drift from what the provider itself considers the boundary.
- Forgetting to round to whole cents (or the smallest currency unit) and passing fractional-cent amounts to a charge API — most providers require integer amounts, and an unrounded proration calculation can produce a value the API rejects outright.
- Not deciding up front what a negative `netChargeCents` (a customer credit) should actually do — silently ignoring it, instead of either issuing an account credit or reducing the next invoice, means a downgrading customer is effectively never refunded for the unused portion of their old plan.

## Hands-On Exercises

1. **Run all three scenarios as shown.** Save `computeProration` and the three `console.log` calls from section 2 into one file and run it with `node`. Confirm your output matches what's shown above for all three scenarios.
2. **Manually verify Scenario 1 by hand.** Before looking at the "Manually verifying" paragraph in section 2, work out on paper: with 15 of 30 days remaining ($10 → $20 plan), what fraction of the cycle is left, what's the unused credit, what's the new plan's prorated charge, and what's the net? Confirm your hand calculation matches the function's actual output (`netChargeCents: 500`, charge direction).
3. **Add a fourth scenario: same-day plan change.** Call `computeProration` with `daysRemaining` equal to `totalDaysInCycle` (i.e., the change happens on day 1 of the cycle, so the *entire* cycle remains). Run it and confirm `fractionRemaining` is `1`, meaning the customer is credited the *full* old price and charged the *full* new price — reason through why this is the correct edge-case behavior (it's equivalent to a full plan swap, not a partial-period proration).
4. **Add a fifth scenario: change on the last day.** Call it with `daysRemaining: 0`. Confirm the function returns `fractionRemaining: 0` and both the credit and new charge are `0` — reason through why zero days remaining means there's nothing left to prorate (the old plan already covered the entire cycle, and the new plan doesn't start being used until the next cycle).
5. **Break the guard rail on purpose.** Call `computeProration` with `daysRemaining: 40, totalDaysInCycle: 30` (more days remaining than exist in the cycle — an impossible input) and confirm it throws the expected validation error, rather than silently returning a nonsensical fraction greater than 1.

## Interview Q&A

**Q: In plain terms, what problem does proration solve?**
A: It ensures a customer who changes plans mid-cycle isn't double-charged for days already paid for under the old plan, and isn't undercharged for days they'll actually use under the new plan — it splits the current billing cycle into an "old rate" portion and a "new rate" portion and settles only the difference.

**Q: What's the core proration formula?**
A: `fractionRemaining = daysRemaining / totalDaysInCycle`, then `unusedCredit = oldPrice * fractionRemaining`, `newPlanCharge = newPrice * fractionRemaining`, and `netAmount = newPlanCharge - unusedCredit` — positive means charge the customer, negative means credit them.

**Q: Why is it risky to compute `daysRemaining` from "today" compared to a wall clock, rather than from the provider's actual current-period-end value?**
A: Because clock skew, timezone handling, or a delayed webhook can make a locally computed "days until renewal" drift from what the provider's system actually considers the cycle boundary, producing an incorrect proration even though the formula itself is correct.

**Q: Do Stripe, Razorpay, and PayPal all prorate plan changes the same way?**
A: No — while the underlying days-remaining/total-days math is a reasonable general mental model, the three providers differ in whether a change takes effect immediately or on the next cycle, and in how/when the proration amount is actually invoiced; this is configurable and provider/version-specific, so it should be verified against current docs rather than assumed.

**Q: What should happen when the net proration amount is negative (a credit)?**
A: The application needs an explicit decision — either apply it as an account credit toward a future invoice or reduce the next charge by that amount. Silently discarding a negative proration result means a downgrading customer effectively loses the value of the unused portion of their old plan.
