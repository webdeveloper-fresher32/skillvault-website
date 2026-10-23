# Client and Server Signature Verification

Razorpay has a verification step that Stripe's flow (Phase 3) doesn't have an equivalent of: after Checkout completes, the browser itself receives a payment ID, the order ID, and a signature — and your server must verify that signature before trusting the payment, in addition to (not instead of) the webhook verification Phase 2 already taught in general. This lesson is entirely about that extra, Razorpay-specific step.

## 1. The Client-Side Verification Step (Razorpay-Specific)

When Razorpay Checkout's `handler` callback fires (introduced in the previous lesson), the response object it receives contains a payment ID, the order ID, and a signature value computed by Razorpay. Your frontend must send all three of these to your own server, and your server — never the browser — computes the expected signature and compares it. The expected signature is an HMAC-SHA256 of the order ID and payment ID concatenated with a pipe character, using your Razorpay key secret:

```text
expected_signature = HMAC-SHA256(key_secret, order_id + "|" + payment_id)
```

Here's a real, runnable Node.js implementation, using mock order/payment IDs (no live Razorpay credentials required to run this):

```js
const crypto = require("crypto");

const secret = "test_key_secret_abc123";
const order_id = "order_mock_9A33XWu170gUtm";
const payment_id = "pay_mock_29QQoUBi66xm2f";

function computeExpectedSignature(order_id, payment_id, secret) {
  return crypto
    .createHmac("sha256", secret)
    .update(order_id + "|" + payment_id)
    .digest("hex");
}

const expected = computeExpectedSignature(order_id, payment_id, secret);
console.log("Expected signature:", expected);
```

Actual output from running this with `node`:

```text
Expected signature: 78c348ed1387ec59fc5be0a02cd565cdae0f131081791add33539aaf4ba73b94
```

Your server then compares this `expected` value to the `razorpay_signature` the client forwarded, using a constant-time comparison (Phase 2, Lesson 2), just like any other HMAC check:

```js
function verifyPaymentSignature(order_id, payment_id, secret, receivedSignature) {
  const expected = computeExpectedSignature(order_id, payment_id, secret);
  const expectedBuf = Buffer.from(expected, "hex");
  const receivedBuf = Buffer.from(receivedSignature, "hex");
  if (expectedBuf.length !== receivedBuf.length) {
    return false;
  }
  return crypto.timingSafeEqual(expectedBuf, receivedBuf);
}
```

## 2. Why This Exists (Extra Defense Against a Compromised Client)

The webhook (Lesson 3) is already the authoritative server-to-server signal — so why does Razorpay also hand the browser a signature to relay back? Because the `handler` callback result is client-reported: a compromised or modified frontend could call your server's "mark as paid" endpoint with a fabricated payment ID and no signature at all, well before any webhook arrives (webhooks can take some time to be delivered). Verifying the client-relayed signature lets your server reject an obviously forged "I paid" claim immediately, without waiting on the webhook, while still not fully trusting the browser — the signature can only have been produced by someone holding the key secret, so a client that doesn't have it can't fabricate a valid one.

## 3. This Is IN ADDITION TO Webhook Verification, Not Instead Of

This client-side check and the webhook check verify two different things arriving over two different paths, and Razorpay's documented integration pattern expects you to do both:

- The client-side signature (this lesson) verifies the payment ID/order ID pair the *browser* is claiming, immediately after Checkout closes.
- The webhook signature (Lesson 3) verifies an event the *provider's backend* sends you independently, and remains the authoritative source of truth per Phase 2's Lesson 1 — a browser that never calls your server back (closed tab, crashed app) still gets its order correctly marked paid once the webhook lands.

Skipping the webhook check because "the client-side signature already passed" reintroduces exactly the client-trust problem Phase 2's Lesson 1 warned about for redirects in general — a passed client-side check here is a stronger signal than a bare redirect, but it is still a client-reported path, not a substitute for the server-to-server one.

## Comparison

| Aspect | Client-side signature check (this lesson) | Webhook signature check (Lesson 3) |
|---|---|---|
| Who sends the data being verified | The browser, relaying `order_id` + `payment_id` + `signature` from the Checkout `handler` callback | Razorpay's backend, POSTing an event directly to your server |
| What's hashed | `order_id + "|" + payment_id` | The raw webhook request body |
| Secret used | Your Razorpay key secret | A separately configured webhook secret (Lesson 3) |
| Timing | Immediately after Checkout closes, if the browser stays connected | Whenever Razorpay's backend delivers the event, independent of the browser |
| Authoritative on its own? | No — extra defense against a forged client callback, not a replacement for the webhook | Yes — the server-to-server signal Phase 2 established as authoritative |

## Common Mistakes

- Treating a passed client-side signature check as sufficient on its own and skipping webhook verification entirely — this is the same client-vs-server trust distinction Phase 2's Lesson 1 taught in the abstract about redirects vs. webhooks; the client-side check here is stronger than a bare redirect (it's cryptographically verified), but it is still a client-reported path and must not replace the webhook.
- Mixing up the concatenation order — using `payment_id + "|" + order_id` instead of `order_id + "|" + payment_id` — which silently produces a signature that never matches a genuine one. Demonstrated below with real computed values.
- Verifying the signature using the webhook secret instead of the key secret (or vice versa in Lesson 3) — these are different secrets serving different checks; using the wrong one always fails verification even for a genuine payment.
- Skipping the client-side check "because the webhook will catch it eventually" — this delays fraud/error detection and user feedback until the webhook arrives, instead of rejecting an obviously forged client callback immediately.

## Hands-On Exercises

1. **Run the signature check with the correct concatenation order.** Save the full script below as `sig-check.js` and run `node sig-check.js`:

   ```js
   const crypto = require("crypto");

   const secret = "test_key_secret_abc123";
   const order_id = "order_mock_9A33XWu170gUtm";
   const payment_id = "pay_mock_29QQoUBi66xm2f";

   function computeExpectedSignature(order_id, payment_id, secret) {
     return crypto.createHmac("sha256", secret).update(order_id + "|" + payment_id).digest("hex");
   }

   function verifyPaymentSignature(order_id, payment_id, secret, receivedSignature) {
     const expected = computeExpectedSignature(order_id, payment_id, secret);
     const expectedBuf = Buffer.from(expected, "hex");
     const receivedBuf = Buffer.from(receivedSignature, "hex");
     if (expectedBuf.length !== receivedBuf.length) return false;
     return crypto.timingSafeEqual(expectedBuf, receivedBuf);
   }

   // Correct order: order_id + "|" + payment_id
   const correctSignature = computeExpectedSignature(order_id, payment_id, secret);
   console.log("Correct-order signature:", correctSignature);

   // Mistake: concatenation order swapped
   const swappedSignature = crypto.createHmac("sha256", secret).update(payment_id + "|" + order_id).digest("hex");
   console.log("Swapped-order signature:", swappedSignature);

   console.log("Do they match?", correctSignature === swappedSignature);
   console.log("Verify with correct concatenation order:", verifyPaymentSignature(order_id, payment_id, secret, correctSignature));
   console.log("Verify using swapped-order signature as 'received':", verifyPaymentSignature(order_id, payment_id, secret, swappedSignature));
   ```

   Actual output from running this with `node`:

   ```text
   Correct-order signature: 78c348ed1387ec59fc5be0a02cd565cdae0f131081791add33539aaf4ba73b94
   Swapped-order signature: ac36d62ce8e2eebff63c1bff902c628ff286ee302d4dda18a05e2f289d421c19
   Do they match? false
   Verify with correct concatenation order: true
   Verify using swapped-order signature as 'received': false
   ```

2. **Confirm the correct case matches.** From the output above, confirm `verifyPaymentSignature(order_id, payment_id, secret, correctSignature)` returns `true` — this is the "everything lines up" case: server-computed expected signature equals what would be a genuine Razorpay-issued one for this order/payment pair.
3. **Confirm the swapped case fails.** From the same output, confirm that using `payment_id + "|" + order_id` (reversed) produces a completely different hex digest, and that verifying with it as the "received" signature against the correct order returns `false` — this concretely demonstrates why getting the concatenation order backwards silently breaks verification rather than throwing an obvious error.
4. **Tamper with the payment ID.** Modify the script to compute `verifyPaymentSignature(order_id, "pay_mock_DIFFERENT", secret, correctSignature)` — i.e., verify the original signature against a different payment ID — and confirm it returns `false`.
5. **Paper exercise: where does each ID come from?** For a completed Checkout flow, write down which of `order_id`, `payment_id`, and `signature` originate from your server (Lesson 1) versus from Razorpay's Checkout `handler` callback (this lesson).

## Interview Q&A

**Q: What three values does Razorpay Checkout's `handler` callback give the client after a payment?**
A: A payment ID, the order ID, and a signature that your server must verify before trusting the payment.

**Q: How is the client-side signature computed?**
A: `HMAC-SHA256(key_secret, order_id + "|" + payment_id)` — the order ID and payment ID are concatenated with a pipe separator, then HMAC'd with your Razorpay key secret.

**Q: Is verifying this client-side signature enough on its own, without also verifying webhooks?**
A: No — it's an additional check on top of webhook verification, not a replacement for it. The webhook remains the authoritative server-to-server signal from Phase 2; the client-side check only adds early defense against an obviously forged client callback.

**Q: What happens if you concatenate `payment_id + "|" + order_id` instead of `order_id + "|" + payment_id` when computing the expected signature?**
A: The HMAC input bytes are different, so the computed signature never matches a genuine one from Razorpay — verification always fails, silently, with no indication of what went wrong beyond "signature mismatch."

**Q: Why does Razorpay bother with a client-relayed signature at all, if the webhook is authoritative?**
A: Because the webhook may take time to arrive (or the browser may report back before it does), and a compromised/modified client could otherwise claim a payment succeeded with a fabricated payment ID; the signature can only be produced by someone holding the key secret, so it lets the server reject a forged claim immediately rather than trusting the browser outright.
