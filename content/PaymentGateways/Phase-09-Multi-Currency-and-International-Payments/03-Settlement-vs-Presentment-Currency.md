# Settlement vs. Presentment Currency

A customer might see and pay a charge in one currency, while a completely different currency lands in the merchant's bank account days later. These are two distinct concepts — presentment currency and settlement currency — and conflating them is a common source of "why doesn't my payout match what I charged" confusion for both merchants and customers.

## 1. Presentment vs. Settlement Currency

The **presentment currency** is the currency the customer sees and is charged in at checkout — what's displayed on the checkout page and what their card or bank statement shows as the transaction amount. The **settlement currency** is the currency that actually arrives in the merchant's payout/bank account. These are often the same currency (a US merchant charging US customers in USD, settling in USD), but they diverge whenever a merchant sells internationally: a merchant with a USD-only payout account who charges a customer in EUR is presenting in EUR but settling in USD, and the provider performs a currency conversion somewhere between the charge and the payout.

```
Customer's card statement:  charged  EUR 100.00   (presentment currency)
                                     |
                                     |  provider converts at some exchange rate,
                                     |  usually deducting a conversion fee
                                     v
Merchant's bank deposit:    receives USD  90.16   (settlement currency)
```

## 2. Currency Conversion Fees

When a provider converts a charge from the presentment currency to the merchant's settlement currency, it typically applies a currency-conversion fee on top of the exchange rate itself — this is standard practice across payment providers and card networks, but the exact percentage varies by provider, by currency pair, and changes over time as providers update their pricing, so no specific percentage should be treated as a permanent fact without checking current provider pricing documentation. What's stable is the shape of the calculation: convert the presentment amount using an exchange rate, then deduct a percentage-based fee from the converted amount, leaving a settlement amount that's typically somewhat less favorable than a "pure" market exchange rate conversion would produce.

```js
function convertPresentmentToSettlement(presentmentAmount, exchangeRate, feePercent) {
  const converted = presentmentAmount * exchangeRate;
  const fee = converted * (feePercent / 100);
  const settlementAmount = converted - fee;
  return {
    presentmentAmount,
    exchangeRate,
    feePercent,
    convertedBeforeFee: Number(converted.toFixed(4)),
    feeAmount: Number(fee.toFixed(4)),
    settlementAmount: Number(settlementAmount.toFixed(2)),
  };
}

module.exports = { convertPresentmentToSettlement };
```

Run against three scenarios:

```js
const scenarios = [
  { presentmentAmount: 100.00, exchangeRate: 0.92, feePercent: 2.0, note: 'USD 100 charged, settles in EUR, 2% conversion fee' },
  { presentmentAmount: 5000.00, exchangeRate: 0.012, feePercent: 1.5, note: 'INR 5000 charged, settles in USD, 1.5% conversion fee' },
  { presentmentAmount: 250.00, exchangeRate: 1.00, feePercent: 0, note: 'GBP 250 charged, settles in GBP, no conversion needed' },
];

for (const s of scenarios) {
  console.log(s.note, convertPresentmentToSettlement(s.presentmentAmount, s.exchangeRate, s.feePercent));
}
```

Actual output, captured by running this with `node`:

```
USD 100 charged, settles in EUR, 2% conversion fee {
  presentmentAmount: 100,
  exchangeRate: 0.92,
  feePercent: 2,
  convertedBeforeFee: 92,
  feeAmount: 1.84,
  settlementAmount: 90.16
}
INR 5000 charged, settles in USD, 1.5% conversion fee {
  presentmentAmount: 5000,
  exchangeRate: 0.012,
  feePercent: 1.5,
  convertedBeforeFee: 60,
  feeAmount: 0.9,
  settlementAmount: 59.1
}
GBP 250 charged, settles in GBP, no conversion needed {
  presentmentAmount: 250,
  exchangeRate: 1,
  feePercent: 0,
  convertedBeforeFee: 250,
  feeAmount: 0,
  settlementAmount: 250
}
```

The exchange rates and fee percentages above are illustrative inputs to the calculation, not asserted as any real provider's current published rates — the point of the example is the shape of the math (convert, then deduct a fee), not specific numbers to rely on.

## 3. Multi-Currency Payout Accounts

Some providers let a merchant set up multiple payout accounts, each denominated in a different currency, so that a charge presented in EUR settles into a EUR-denominated payout account and a charge presented in USD settles into a USD-denominated payout account — avoiding a conversion (and its fee) for currencies the merchant does business in often enough to justify a dedicated account. Whether a given provider offers this, in which markets, and under what account requirements, varies by provider and by the merchant's own banking setup — a merchant should confirm what payout currencies their provider and their bank actually support before assuming a multi-currency setup is available to them. Even with a multi-currency payout account, any presentment currency the merchant doesn't hold a matching payout account for will still be converted, with a fee, into whichever settlement currency is configured as the fallback.

## Comparison

| Aspect | Same-currency settlement | Cross-currency settlement (no multi-currency account) | Cross-currency settlement (with matching multi-currency payout account) |
|---|---|---|---|
| Presentment currency | Matches settlement currency | Differs from settlement currency | Differs from the merchant's default payout currency, but matches this specific payout account |
| Conversion performed | None | Yes, at the provider's exchange rate | None for this currency, since a dedicated payout account exists for it |
| Conversion fee charged | None | Yes, typically a percentage of the converted amount | None for this currency |
| What the merchant sees in their bank account | Exact presentment amount (before any provider processing fees) | A converted, fee-reduced amount in the settlement currency | The presentment amount's own currency, deposited directly |
| Availability | Universal — the default case | Universal fallback when no matching payout account exists | Depends on provider and merchant banking setup — confirm before assuming it's available |

## Common Mistakes

- Assuming the amount charged to the customer is exactly what arrives in the merchant's bank account — ignoring both the currency-conversion fee and exchange-rate timing (the rate applied at settlement isn't guaranteed to match the rate at the moment of charge, since settlement can happen with some delay).
- Not clearly displaying the presentment currency to the customer at checkout — if a customer is charged in a currency they didn't expect, their card or bank statement shows a converted amount (via their own card network's conversion) that doesn't match what they thought they were paying, causing support confusion that has nothing to do with the merchant's own settlement setup.
- Treating a single quoted exchange rate or fee percentage as permanent — providers adjust these over time and they can vary by currency pair, so hardcoding a specific rate or fee anywhere in reporting or reconciliation logic will drift out of accuracy.
- Forgetting that even a multi-currency payout setup only avoids conversion for currencies with a matching dedicated account — every other presentment currency still falls back to conversion with a fee.

## Hands-On Exercises

1. **Run the settlement function against three scenarios.** Using `convertPresentmentToSettlement`, compute the settlement amount for: USD 100.00 at exchange rate 0.92 with a 2.0% fee; INR 5000.00 at exchange rate 0.012 with a 1.5% fee; and GBP 250.00 at exchange rate 1.00 with a 0% fee. Confirm your output matches the captured results in section 2.
2. **Verify one conversion by hand.** For USD 100.00 at exchange rate 0.92 with a 2.0% fee: converted = 100 × 0.92 = 92.00; fee = 92.00 × 0.02 = 1.84; settlement = 92.00 − 1.84 = 90.16 — matches the captured output.
3. **Explain a same-currency case.** For the GBP 250.00 scenario (exchange rate 1.00, fee 0%), explain in one sentence why the settlement amount exactly equals the presentment amount, and under what real-world condition this scenario would actually occur.
4. **Spot the discrepancy.** A customer is charged USD 100.00. The merchant's payout report later shows a deposit of USD 90.16 for that transaction, with the merchant's settlement currency also being USD. Using this lesson's concepts, name the two things (beyond the base fee logic already shown) an investigation should rule out before assuming something is wrong.
5. **Design a multi-currency decision.** A merchant processes roughly equal volumes of EUR- and USD-presented charges but only holds a USD payout account. Write two or three sentences on what change (if their provider and bank support it) would reduce their conversion-fee exposure, and why.

## Interview Q&A

**Q: What's the difference between presentment currency and settlement currency?**
A: Presentment currency is what the customer sees and is charged in at checkout; settlement currency is what actually arrives in the merchant's payout/bank account. They're often the same, but diverge whenever a merchant sells in a currency their payout account isn't denominated in.

**Q: Why might a merchant receive less than the "converted at market rate" amount when a cross-currency charge settles?**
A: Because providers typically deduct a currency-conversion fee — a percentage of the converted amount — on top of applying their exchange rate, so the amount that lands in the bank account is the converted amount minus that fee, not a pure market-rate conversion.

**Q: What's a multi-currency payout account, and what does it avoid?**
A: It's a payout account denominated in a specific currency, letting charges presented in that same currency settle directly without conversion — avoiding both the exchange-rate exposure and the conversion fee for that particular currency, though only for currencies with a matching dedicated account.

**Q: Why should a merchant clearly display the presentment currency to the customer?**
A: Because if the customer doesn't know what currency they're being charged in, their own card or bank statement may show a converted amount (via their card network's own conversion) that doesn't match their expectation, generating support confusion unrelated to the merchant's settlement setup.

**Q: Is it safe to hardcode a specific conversion fee percentage in reconciliation logic?**
A: No — conversion fees vary by provider and currency pair and change over time as providers update pricing, so reconciliation logic should treat the fee as a value to look up or read from the transaction record, not a constant to assume permanently.
