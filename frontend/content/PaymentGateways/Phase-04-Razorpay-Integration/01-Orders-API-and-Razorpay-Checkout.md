# Orders API and Razorpay Checkout

Razorpay's version of Phase 1's "payment object" is the Order — a server-side record of amount and currency that the client attaches a payment method to through a hosted widget called Razorpay Checkout. The names are Razorpay-specific; the shape underneath is the same three-step handshake Phase 1 already taught.

## 1. Creating an Order

An Order is created server-side, using your Razorpay key ID and key secret, and it carries an `amount` and a `currency`. The critical Razorpay-specific detail: `amount` must be expressed in **paise**, India's minor currency unit (1 rupee = 100 paise) — exactly the same "smallest unit, always an integer" rule Stripe applies with cents, just with a different name and a different multiplier. An order for ₹2,000.00 is created with `amount: 200000`, not `amount: 2000`.

```js
// Illustrative only — representative of the shape of the Node SDK's order-creation
// call, not asserted as the exact live method signature. Requires a live Razorpay
// test-mode key id/secret to actually execute. Syntax-checked with `node --check` only.
const Razorpay = require("razorpay");

const instance = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

async function createOrder() {
  const order = await instance.orders.create({
    amount: 200000, // paise — 200000 paise = INR 2000.00, NOT INR 200000
    currency: "INR",
    receipt: "receipt_mock_001",
  });
  console.log(order.id, order.status);
  return order;
}

module.exports = { createOrder };
```

The server returns the Order's ID to the client. The client never creates the Order itself and never gets to set the amount — the same server-authority guarantee from Phase 1's Lesson 1.

## 2. Razorpay Checkout (Client-Side)

Razorpay Checkout is a hosted widget: a small script your page loads that opens a payment form (card, UPI, wallet, netbanking, depending on what's enabled on the account) inside an overlay on top of your page, initialized with the Order ID your server just created. The customer never enters payment details into a form your own code renders — the widget owns that surface, which keeps raw payment data out of your server's reach, the same PCI-scope benefit Phase 1's Lesson 2 covered for hosted fields generally.

```js
// Illustrative browser-side snippet — representative of how Checkout is invoked,
// not asserted as the exact current option names. Requires the Checkout script to be
// loaded on the page and a real order_id from a live server-side Order creation.
const options = {
  key: "rzp_test_xxxxxxxxxxxx", // publishable key id, safe for the browser
  amount: 200000, // paise, shown to the customer — should match the Order's amount
  currency: "INR",
  order_id: "order_mock_9A33XWu170gUtm", // the ID returned by step 1
  handler: function (response) {
    // response carries the payment id, order id, and a signature —
    // covered in the next lesson.
  },
};
// const rzp = new window.Razorpay(options);
// rzp.open();
```

## 3. Mapping to Phase 1's 3-Step Flow

| Phase 1 Step | Razorpay Equivalent |
|---|---|
| 1. Server creates the payment object | Server creates an `Order` (amount in paise, currency) |
| 2. Client collects the payment method | Razorpay Checkout widget opens, initialized with the `order_id` |
| 3. Server confirms/captures | Server verifies the client-side signature (next lesson), then relies on webhook confirmation (Lesson 3) as the authoritative source |

## Comparison

| Aspect | Razorpay (Order + Checkout) | Stripe (PaymentIntent + Elements) | Stripe (Checkout Session) |
|---|---|---|---|
| Step 1 object | `Order`, created server-side with amount + currency | `PaymentIntent`, created server-side with amount + currency | `Checkout Session`, created server-side |
| Minor currency unit | Paise (1 INR = 100 paise) | Cents (1 USD = 100 cents) | Cents, same as PaymentIntent |
| Step 2 UI | Razorpay Checkout hosted overlay widget, opened with `order_id` | Stripe Elements mounted in your own page | Stripe-hosted page, customer redirected there |
| UI control | Low-to-medium — overlay styling is configurable but Razorpay controls the form itself | High — you control the surrounding page | Low — Stripe controls the entire page |
| Step 3 confirmation | Client-side signature check (this phase, Lesson 2) plus webhook (Lesson 3) | Webhook (`payment_intent.succeeded`) | Webhook (`checkout.session.completed`) |

## Common Mistakes

- Passing the amount in rupees instead of paise — `amount: 2000` for an intended ₹2,000.00 charge actually creates an order for ₹20.00, the same class of bug as Stripe's cents-vs-dollars mistake from Phase 3. A later phase on currency handling covers minor-unit conversion across providers in more depth.
- Assuming every payment method (card, UPI, wallet, netbanking, etc.) is available by default on every account — which methods actually appear in the Checkout widget can depend on account configuration, so don't hardcode assumptions about what a customer will see without checking the account's actual setup.
- Creating the Order client-side or letting the client supply the amount that gets sent to Checkout, instead of always sourcing the Order (and its amount) from a server-side call — the same tampering risk Phase 1's Lesson 1 warned about generally.
- Treating the Checkout widget's `handler` callback firing as proof the payment succeeded, without the server-side verification the next lesson covers.

## Hands-On Exercises

1. **Syntax-check the order-creation snippet.** Save the code from section 1 as `create-order.js` and run `node --check create-order.js`. Confirm it reports no syntax errors. (It will not run successfully without a live Razorpay test-mode key id/secret — that's expected; this only confirms the JavaScript is well-formed.)
2. **Paper exercise: convert rupees to paise.** Convert each of these rupee amounts to the integer paise value you'd pass as `amount`: (a) ₹1.00 → 100 paise; (b) ₹49.50 → 4950 paise; (c) ₹1,999.99 → 199999 paise; (d) ₹100,000.00 → 10000000 paise. Work through each conversion yourself before checking against the answers just given, and confirm you get the same integers.
3. **Spot the bug.** Given `instance.orders.create({ amount: 500, currency: "INR" })` where the intent was to charge ₹500.00, write down what amount this actually creates an order for, and the corrected `amount` value.
4. **Map the 3-step flow.** Using the table in section 3, write down — in your own words — what would go wrong if step 2 (Checkout) were skipped and the client tried to mark the order paid immediately after step 1 returned an `order_id`.
5. **Compare to Stripe (paper exercise).** Using the Comparison table above and Phase 3's Lesson 1, write one sentence explaining why "Order in Razorpay" and "PaymentIntent in Stripe" are the same conceptual object despite different names.

## Interview Q&A

**Q: Why must a Razorpay Order's `amount` be in paise rather than rupees?**
A: Razorpay's API expects amounts as an integer in the smallest currency unit — paise, where 100 paise = 1 rupee — the same reason Stripe expects cents; passing a rupee-denominated integer directly under-charges by a factor of 100.

**Q: What does Razorpay Checkout do, in terms of PCI scope?**
A: It's a hosted widget that collects the customer's payment details inside its own overlay, so raw card/payment data never touches your server or your own page's form fields — the same scope-reduction benefit as any hosted-fields approach.

**Q: Is a successful Order creation on the server enough to consider the payment done?**
A: No — Order creation is only step 1 of the 3-step flow. The customer still has to complete Checkout (step 2), and the payment isn't authoritative until it's verified/confirmed (step 3, covered in the next two lessons).

**Q: How does Razorpay's Order + Checkout model map onto Stripe's PaymentIntent + Elements model?**
A: They're the same conceptual shape — a server-created step-1 object holding amount/currency, and a client-side step-2 widget that collects the payment method — just with different object names and a different minor currency unit.

**Q: What's wrong with `instance.orders.create({ amount: 2000, currency: "INR" })` if the goal was to charge ₹2,000.00?**
A: `2000` paise is ₹20.00, not ₹2,000.00 — the correct value is `amount: 200000`.
