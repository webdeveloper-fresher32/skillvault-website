# Payment Intents and Checkout Sessions

Stripe gives you two starting points for the same underlying goal: a low-level object you build your own UI around, and a hosted page that needs almost no UI work at all. Both are the same "step 1" from Phase 1's checkout flow shape — a server-created object holding amount and currency — wearing two different levels of pre-built scaffolding around them.

## 1. Creating a PaymentIntent

A PaymentIntent is Stripe's name for the "payment object" from Phase 1's Lesson 1: a server-side object that tracks a single payment attempt from creation through to a final outcome. It carries `amount`, `currency`, and a `status` field that moves through a defined lifecycle as the payment progresses — `requires_payment_method` → `requires_confirmation` → `processing` → `succeeded` (with `requires_action` and `canceled` as branches off that path, covered more in the next lesson). This is exactly the status progression the mock `flow.js` exercise in Phase 1 modeled, just with Stripe's real field names.

```js
// Illustrative only — requires a live Stripe secret key to actually execute.
// Not run against a real Stripe account; syntax-checked with `node --check` only.
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

async function createPaymentIntent() {
  const paymentIntent = await stripe.paymentIntents.create({
    amount: 2000, // $20.00 — Stripe expects the smallest currency unit (cents), not dollars
    currency: "usd",
  });
  console.log(paymentIntent.status); // starts as "requires_payment_method"
  return paymentIntent;
}

module.exports = { createPaymentIntent };
```

The server creates this PaymentIntent using a secret key, then hands the client a `client_secret` (not shown above) that lets the client attach a payment method without ever being able to change the amount — the same server-authority guarantee Phase 1's Lesson 1 explained.

## 2. Checkout Sessions (Hosted Checkout)

A Checkout Session is Stripe's fully hosted, pre-built checkout page: instead of building your own form and mounting Elements yourself, you create a Session server-side and redirect the customer to a Stripe-hosted URL that already contains the payment form, styling, and confirmation flow. This is the simplest integration path Stripe offers, and it maps directly onto Phase 1's Lesson 2 on PCI scope — because Stripe hosts the entire page rather than just an iframe embedded within yours, there's no risk that some unrelated script on your own page could ever be judged to interfere with the payment form, which is exactly the redirect-based row of Phase 1's SAQ table (the lowest-burden tier, with no dependency on how your own page's other JavaScript behaves).

```js
// Illustrative only — requires a live Stripe secret key to actually execute.
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

async function createCheckoutSession() {
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: { name: "Sample Product" },
          unit_amount: 2000, // cents, not dollars
        },
        quantity: 1,
      },
    ],
    success_url: "https://example.com/success",
    cancel_url: "https://example.com/cancel",
  });
  return session.url; // redirect the customer's browser here
}

module.exports = { createCheckoutSession };
```

## 3. Choosing Between Them

The two approaches sit at opposite ends of the same control-versus-speed tradeoff every provider's toolkit offers. PaymentIntents paired with Elements (next lesson) mean you build and own the checkout UI, which costs more integration work but lets you keep the customer on your own page and customize the experience. Checkout Sessions redirect the customer to a Stripe-hosted page you don't control the layout of, but you can often go from zero to a working checkout in a fraction of the time.

## Comparison

| Aspect | PaymentIntents + Elements | Checkout Sessions |
|---|---|---|
| Where the payment form lives | Your own page, in a Stripe-hosted iframe (Elements) | A page fully hosted by Stripe, customer is redirected there |
| UI control | High — you control layout, branding, and flow around the form | Low — limited customization of Stripe's hosted page |
| Integration effort | More — you build the checkout page, mount Elements, call a confirmation method | Less — one API call to create the Session, then redirect |
| PCI scope reduction | Strong — raw card data never touches your server, but scope can slip if unrelated page scripts interfere with the mounted Element | Strong — raw card data never touches your server, and there's no page of yours involved for other scripts to interfere with |
| Good fit for | Products needing a custom, embedded checkout experience | Fastest path to accepting payments, MVPs, simple carts |

## Common Mistakes

- Passing a dollar amount instead of the minor-unit integer Stripe expects — `2000` for $20.00, not `20`. Sending `20` charges $0.20, not $20.00. A later phase on currency handling covers this in more depth, since not every currency uses the same number of minor units.
- Forgetting to set payment method configuration and getting surprised by which payment methods actually show up on the PaymentIntent or Checkout Session — Stripe can determine available payment methods dynamically, so an unconfigured integration may show (or omit) methods you didn't expect.
- Treating the client-side redirect back from a Checkout Session's `success_url` as proof the payment succeeded, instead of waiting for the corresponding webhook — this is the exact mistake Phase 1's Lesson 1 and Phase 2's Lesson 1 both warned against, and it applies here unchanged.
- Re-creating a new PaymentIntent or Checkout Session on every retry of the same checkout attempt instead of reusing the original object — this echoes Phase 1's Lesson 3 on idempotency; Stripe's API also accepts an `Idempotency-Key` header for exactly this reason.

## Hands-On Exercises

1. **Syntax-check the Checkout Session snippet.** Save the `createCheckoutSession` code from section 2 as `checkout-session.js` and run `node --check checkout-session.js`. Confirm it reports no syntax errors. (It will not run successfully without a real Stripe secret key — that's expected; this exercise only confirms the JavaScript itself is well-formed.)
2. **Syntax-check the PaymentIntent snippet.** Do the same for the `createPaymentIntent` code from section 1: save it as `payment-intent.js` and run `node --check payment-intent.js`.
3. **Map Phase 1's 3-step flow onto Stripe's object names (paper exercise).** Using Phase 1 Lesson 1's three steps (create → collect method → confirm/capture), write down which Stripe object or call corresponds to each step for a PaymentIntent-based integration, and separately for a Checkout Session-based integration.
4. **Spot the amount bug.** Given `stripe.paymentIntents.create({ amount: 20, currency: "usd" })`, write down what dollar amount this actually charges and explain why, referencing the Common Mistakes section above.
5. **Decide which to use.** For each scenario below, decide PaymentIntents+Elements or Checkout Sessions, and justify in one sentence: (a) a mobile app with a fully custom native checkout screen; (b) a solo developer's weekend side-project store with no dedicated frontend engineer; (c) a marketplace that needs the checkout page to visually match the rest of its site pixel-for-pixel.

## Interview Q&A

**Q: What is a Stripe PaymentIntent, in terms of the checkout flow shape from Phase 1?**
A: It's Stripe's specific name for the server-created "payment object" from Phase 1's step 1 — it holds amount and currency and tracks status through the payment's lifecycle.

**Q: List the PaymentIntent status progression for a straightforward successful payment.**
A: `requires_payment_method` → `requires_confirmation` → `processing` → `succeeded`.

**Q: Why do Checkout Sessions reduce PCI scope more than Elements does?**
A: Because Stripe hosts the entire checkout page itself, not just an iframe embedded within your page — there's no page of yours involved in rendering the payment form at all.

**Q: What's wrong with `stripe.paymentIntents.create({ amount: 20, currency: "usd" })` if the intent was to charge $20.00?**
A: `20` is interpreted as 20 cents ($0.20), not $20.00 — Stripe amounts are integers in the currency's smallest unit, so the correct value is `2000`.

**Q: When would you choose PaymentIntents + Elements over a Checkout Session?**
A: When you need control over the checkout page's layout and branding, or need the customer to stay on your own domain throughout, even though it costs more integration work than a Checkout Session redirect.
