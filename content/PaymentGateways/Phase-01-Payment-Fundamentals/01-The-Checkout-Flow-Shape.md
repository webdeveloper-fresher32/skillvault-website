# The Checkout Flow Shape

Every major payment provider — Stripe, Razorpay, PayPal, and the rest — implements checkout as the same three-step handshake between your server and the provider, even though each one gives the steps different names. Learning this shape once means you can read any provider's docs and immediately map their vocabulary onto concepts you already understand.

## 1. Why the Flow Is Server-Initiated

The payment object (the thing that holds amount, currency, and status) must be created on your server, never in the browser or mobile app. If the client could create it, it could also set the amount, which means a modified request could turn a $50.00 checkout into a $0.01 charge. The server is the only party that knows the "true" price of a cart, so it must be the one to open the transaction.

```text
Client (browser/app)        Your Server            Provider
     |                           |                      |
     |   "I want to check out"  |                       |
     |-------------------------->                       |
     |                           |  create payment obj  |
     |                           |---------------------->
     |                           |<---------------------- (amount, currency, id)
     |   client_secret / order id|                       |
     |<--------------------------|                       |
```

## 2. The Three-Step Shape

Regardless of provider, the flow always breaks down into three steps:

1. **Server creates a payment/order object** with `amount` and `currency`, using a secret API key. The provider returns an identifier (and often a client-side token) back to the server.
2. **Client collects the payment method** through a hosted widget, embedded iframe, or redirect — the customer enters card details or picks a wallet, but the raw card data never touches your server (more on this in the next lesson).
3. **Server confirms/captures the payment**, and the client either polls the object's status or waits for a webhook telling it the payment succeeded or failed. The client's own "success" screen is not proof the money moved — only the server-confirmed state is authoritative.

```js
// The shape, expressed as three function calls (mock — not live API code)
const payment = createPaymentObject({ amount: 5000, currency: "usd" });   // step 1: server
const withMethod = collectPaymentMethod(payment);                        // step 2: client
const finalResult = confirmAndCapture(withMethod);                       // step 3: server
```

## 3. Where Providers Diverge (Preview)

The three steps are universal, but the object names, the confirmation mechanism (redirect vs. webhook vs. both), and how "test mode" is signaled all differ per provider. Later lessons in this phase (test mode) and the next phase (webhooks) cover those differences in depth — for now, just recognize that "PaymentIntent," "Order," and "Order" in the table below are the same conceptual object wearing different labels.

## Comparison

| Step in the shape | Stripe | Razorpay | PayPal (Orders API v2) |
|---|---|---|---|
| 1. Server creates the payment object | `PaymentIntent` (via `POST /v1/payment_intents`) | `Order` (via `orders.create`) | `Order` (via `POST /v2/checkout/orders`) |
| 2. Client collects payment method | Stripe Elements / Payment Element hosted UI | Razorpay Checkout hosted widget | PayPal Smart Buttons / hosted checkout |
| 3. Server confirms/captures | Confirm the `PaymentIntent`, then listen for `payment_intent.succeeded` webhook | Capture the payment, then verify via webhook (`payment.captured`) | `Order.capture()`, then verify via `PAYMENT.CAPTURE.COMPLETED` webhook |

## Common Mistakes

- Creating the payment/order object client-side (e.g., in browser JS) with an amount the client supplies — this lets a user tamper with the request and pay less than intended.
- Trusting the client-side "success" callback or redirect as proof the payment completed, instead of waiting for server-side confirmation via webhook — the browser can be closed, spoofed, or simply lie; only the provider's server-to-server webhook is authoritative (covered in the next phase).
- Skipping the "confirm" step's re-validation of amount/currency against what the server originally stored, and instead re-reading those values from the incoming request.
- Assuming step 2 (collecting the payment method) is where money actually moves — it isn't; money moves at step 3, confirm/capture.
- Hardcoding a single provider's object names into your business logic in a way that makes swapping or adding a second provider expensive later.

## Hands-On Exercises

1. **Run the 3-step flow yourself.** Save this as `flow.js` and run `node flow.js`:

   ```js
   function serverCreatePaymentObject({ amount, currency }) {
     if (!Number.isInteger(amount) || amount <= 0) {
       throw new Error("amount must be a positive integer (smallest currency unit)");
     }
     return {
       id: "pi_mock_" + Math.random().toString(36).slice(2, 10),
       amount,
       currency,
       status: "requires_payment_method",
     };
   }

   function clientCollectsPaymentMethod(paymentObject) {
     return { ...paymentObject, paymentMethod: "mock_card_tok_4242", status: "requires_confirmation" };
   }

   function serverConfirmAndCapture(paymentObject) {
     if (!paymentObject.paymentMethod) throw new Error("cannot confirm: no payment method attached");
     return { ...paymentObject, status: "succeeded", capturedAmount: paymentObject.amount };
   }

   let payment = serverCreatePaymentObject({ amount: 5000, currency: "usd" });
   console.log("Step 1:", payment);
   payment = clientCollectsPaymentMethod(payment);
   console.log("Step 2:", payment);
   payment = serverConfirmAndCapture(payment);
   console.log("Step 3:", payment);
   ```

   Actual output from running this:

   ```text
   Step 1: {
     id: 'pi_mock_wshay5ii',
     amount: 5000,
     currency: 'usd',
     status: 'requires_payment_method'
   }
   Step 2: {
     id: 'pi_mock_wshay5ii',
     amount: 5000,
     currency: 'usd',
     status: 'requires_confirmation',
     paymentMethod: 'mock_card_tok_4242'
   }
   Step 3: {
     id: 'pi_mock_wshay5ii',
     amount: 5000,
     currency: 'usd',
     status: 'succeeded',
     paymentMethod: 'mock_card_tok_4242',
     capturedAmount: 5000
   }
   ```

   Trace through it: notice `amount` stays `5000` the entire time because it was set once in step 1 and never re-read from anywhere else.

2. **Break step 1's guard rail.** Call `serverCreatePaymentObject({ amount: -5, currency: "usd" })` and confirm it throws. Then try `{ amount: 50.5, currency: "usd" }` (a non-integer) and confirm it also throws — this is why real providers require amounts in the smallest currency unit (cents), which is always an integer.

3. **Spot the bug.** Read this function and find the vulnerability before reading the explanation below it:

   ```js
   function createPaymentObjectOnServer(amount, currency) {
     return { id: "pi_mock_1", amount, currency, status: "requires_payment_method" };
   }

   // BUG: re-reads "amount" from the incoming client request instead of
   // looking up the stored payment object's original amount.
   function insecureConfirm(clientRequestBody) {
     return { id: clientRequestBody.id, amount: clientRequestBody.amount, status: "succeeded" };
   }

   const original = createPaymentObjectOnServer(5000, "usd"); // server intended $50.00
   const tamperedClientRequest = { id: original.id, amount: 1 }; // attacker claims $0.01
   const result = insecureConfirm(tamperedClientRequest);
   console.log(result);
   ```

   Running it produces `{ id: 'pi_mock_1', amount: 1, status: 'succeeded' }` — the server "succeeded" a $0.01 charge for something that should have cost $50.00. The fix: `insecureConfirm` must look up the amount from the object created in step 1 (by `id`), never from the incoming request body.

4. **Rewrite the vulnerable function.** Modify `insecureConfirm` above into a `secureConfirm(id, storedPayments)` that looks the original amount up from a `storedPayments` map keyed by `id`, ignoring any amount the caller passes in. Verify with the same tampered request that the captured amount is still `5000`.

5. **Map a real provider's docs onto the shape.** Open Stripe's or Razorpay's "accept a payment" quickstart in their docs and identify which API call corresponds to each of the three steps in this lesson.

## Interview Q&A

**Q: Why must the payment/order object be created server-side instead of client-side?**
A: Because the object carries the amount and currency; if the client could create it, the client could also set those values, allowing a tampered request to change the price charged.

**Q: Is a client-side "payment successful" message ever enough to mark an order as paid in your database?**
A: No — it should only update UI state. The database should only be updated after server-side confirmation, typically via a webhook, since the client-side signal can be spoofed, dropped, or arrive before the payment is actually final.

**Q: Stripe's PaymentIntent, Razorpay's Order, and PayPal's Order — are these the same thing?**
A: Conceptually yes. All three represent "step 1" of the checkout shape: a server-created object holding amount/currency that the rest of the flow attaches a payment method to and eventually confirms.

**Q: At which of the three steps does money actually move?**
A: Step 3 — confirm/capture. Steps 1 and 2 only set up the transaction and attach a payment method; no funds move until the server confirms/captures.

**Q: If two different providers name their objects differently, does that mean their integration models are fundamentally different?**
A: No — the underlying shape (create → collect method → confirm/capture) is the same; only the vocabulary and some mechanics (redirect vs. webhook-only) differ, which is why understanding the shape lets you onboard a new provider quickly.
