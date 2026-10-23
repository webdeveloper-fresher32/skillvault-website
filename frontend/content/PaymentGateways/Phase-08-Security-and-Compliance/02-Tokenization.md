# Tokenization

Hosted fields (Phase 1, Lesson 2) solve one problem: keeping your server from ever seeing a raw card number *at the moment of a charge*. Tokenization solves a different problem: letting a customer pay again later — a saved card, a subscription renewal (Phase 6) — without your server ever storing, or ever needing to re-collect, the actual card number.

## 1. What a Token Actually Represents

A token is an opaque, provider-generated identifier that stands in for a specific payment method a customer has already provided once. When a customer's card is captured (via a hosted field or a Checkout Session, same as any other charge), the provider can — instead of, or in addition to, completing a one-time charge — return a token referencing that same card for future use. Your server stores the token, not the card number; the token is meaningless to anyone who doesn't hold your provider account's credentials, and it can be used to initiate a *new* charge against the *same* underlying payment method without the customer typing their card details again.

```text
First charge (customer enters card once):
  Customer's card  →  hosted field / Checkout  →  Provider
                                                       |
                                                       v
                                          Provider stores the real card,
                                          returns a TOKEN to your server

Later charge (customer never re-enters anything):
  Your server  →  "charge this token for $X"  →  Provider
                                                       |
                                                       v
                                          Provider looks up the real card
                                          behind the token, charges it
```

## 2. Saved Cards and Reusable Payment Methods

The practical use case is exactly the "saved card" flow you've used as a consumer: a customer checks a "save this card for next time" box, and every subsequent purchase (or an automatic subscription renewal, Phase 6) charges the token instead of asking for card details again. Your server's job is to store the token (plus enough metadata to identify it to the customer — covered in Common Mistakes) against that customer's account, and to pass the token, not a card number, whenever it initiates a future charge.

```js
// Illustrative only — models the SHAPE of what a server stores after tokenization,
// not tied to any single provider's exact field/method names. Requires no network
// call to run; it's plain object modeling. Syntax-checked with `node --check` only.

// What arrives from the provider after the customer's first successful charge
// with "save this card" checked — the raw card number is never part of this object.
function buildSavedPaymentMethodRecord(providerTokenResponse, customerId) {
  return {
    customerId,
    provider: providerTokenResponse.provider, // e.g. "stripe" | "razorpay" | "paypal"
    token: providerTokenResponse.token, // opaque string — meaningless outside this provider
    displayBrand: providerTokenResponse.brand, // e.g. "visa" — for showing the customer
    displayLast4: providerTokenResponse.last4, // last 4 digits ONLY, never the full PAN
    displayExpiry: providerTokenResponse.expiry, // e.g. "12/2027"
    createdAt: new Date().toISOString(),
  };
  // Note what's absent: no full card number, no CVV, anywhere in this object.
}

// Later: charging the saved payment method without re-collecting card details.
async function chargeSavedPaymentMethod(savedRecord, amount, currency) {
  // Illustrative call shape only — the real call is provider-specific
  // (e.g. stripe.paymentIntents.create({ customer, payment_method: token, off_session: true, confirm: true })).
  return {
    token: savedRecord.token,
    amount,
    currency,
    status: "charged_using_saved_token", // illustrative placeholder status
  };
}

module.exports = { buildSavedPaymentMethodRecord, chargeSavedPaymentMethod };
```

## 3. Tokens Are Provider-Specific, Not Portable

A token only means something inside the provider account that issued it — it's not a universal representation of the card itself, and no other provider can look it up or charge against it. If a business built its saved-card feature on Provider A and later migrates its integration to Provider B, every existing customer's saved token becomes useless; there is no way to "transfer" a token from one provider to another; each customer has to go through the card-entry flow again with the new provider before their saved-payment-method feature works again. This is the direct switching-cost implication of tokenization, distinct from (but often confused with) ordinary integration-migration effort.

## Comparison

| Provider | How saved/reusable payment methods are conceptually handled | Reference |
|---|---|---|
| Stripe | A PaymentIntent's payment method can be attached to a `Customer` object and reused via a token-like `payment_method` ID on future PaymentIntents (e.g., for off-session/subscription charges) — exact field/method names should be verified against current Stripe docs | Phase 3 (PaymentIntents) |
| Razorpay | Saved payment methods are generally modeled through Razorpay's own customer/token constructs tied to a Razorpay `customer_id`, so a saved card can be reused on a later Order without re-collecting card details — exact object/API names should be verified against current Razorpay docs | Phase 4 (Orders API) |
| PayPal | Reusable payment methods are typically modeled via a stored "payment token" or "vaulted" payment method tied to a PayPal-side customer/payer record, reusable across future Orders v2 create/capture calls without re-approval — exact object/API names should be verified against current PayPal docs | Phase 5 (Orders API v2) |

## Common Mistakes

- Assuming a token issued by one provider can be handed to a different provider to charge the same card — tokens are not portable; the raw card details never left the issuing provider's systems, so there is nothing for another provider to charge against. Switching providers means every existing customer has to re-enter their payment method with the new provider.
- Storing a bare token with no display metadata — if your database only has `token: "tok_abc123"` and nothing else, you can't show a customer "Visa ending in 4242, expires 12/27" on their account page without an extra live API call to the provider on every page load. Store `last4`, card brand, and expiry alongside the token at the time it's created.
- Confusing tokenization with hosted fields — hosted fields (Phase 1, Lesson 2) are about keeping raw card data off your server *at charge time*; tokenization is specifically about *reusing* a payment method *later* without re-collecting it. A hosted-field integration can exist without ever saving a token, and a token-based saved-card feature still typically relies on a hosted field for the *initial* card capture.
- Treating a stored token as equivalent to raw card data for security purposes and, e.g., logging it freely — a token is far lower-risk than a raw PAN since it's useless outside your specific provider account, but it should still be treated as sensitive: anyone with access to your provider account and that token can potentially charge it.

## Hands-On Exercises

1. **Design a saved-payment-method schema (paper exercise).** Sketch a database table (column names and types) for storing a customer's saved payment method. It must include enough fields to display "Visa ending in 4242, expires 12/27" to the customer without a live provider API call, and must NOT include any column capable of holding a full card number or CVV. Cross-check your schema against the `buildSavedPaymentMethodRecord` shape in section 2.

2. **Trace the portability failure (paper exercise).** A business has 10,000 customers with saved cards tokenized through Provider A. They migrate their entire payment integration to Provider B. Write two or three sentences describing what happens to those 10,000 saved tokens, and what the business must do to restore the "saved card" feature for those customers under Provider B.

3. **Distinguish the two mechanisms.** In your own words, write one sentence explaining what hosted fields (Phase 1, Lesson 2) prevent, and a separate sentence explaining what tokenization enables — make sure the two sentences describe genuinely different concerns, not the same one reworded.

4. **Spot the missing metadata bug.** A developer's saved-payment-methods table has exactly one column: `token VARCHAR(255)`. Write down what breaks when the account settings page tries to show the customer a list of their saved cards, and what columns need to be added to fix it.

## Interview Q&A

**Q: What does a payment token represent, and what does it NOT contain?**
A: It's an opaque, provider-generated identifier standing in for a specific payment method the customer already provided once; it does not contain the raw card number itself — the provider holds that, and the token is meaningless outside that provider's systems.

**Q: How does tokenization differ from what hosted fields provide?**
A: Hosted fields keep raw card data off your server at the moment of a charge. Tokenization is about reusing an already-captured payment method later — for a saved card or subscription renewal — without your server ever storing or re-collecting the actual card number. They address different moments in the payment lifecycle.

**Q: Can a token from Provider A be used to charge a customer's card through Provider B?**
A: No — tokens are not portable across providers. The raw card details never leave the issuing provider's systems, so another provider has nothing to charge against; switching providers means every customer's saved payment method must be re-collected.

**Q: What metadata should be stored alongside a token, and why?**
A: Enough display information — typically card brand, last 4 digits, and expiry — so the application can show the customer which saved card they're using without making a live API call to the provider every time the account page loads.

**Q: Why is storing a token still worth treating as sensitive, even though it's not the raw card number?**
A: Anyone with access to both your provider account credentials and a stored token can potentially initiate a charge against it — it's much lower-risk than a raw PAN, but it isn't meaningless data either.
