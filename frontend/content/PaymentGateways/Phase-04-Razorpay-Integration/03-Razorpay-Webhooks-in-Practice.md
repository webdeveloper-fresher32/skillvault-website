# Razorpay Webhooks in Practice

Phase 2 built the general theory, and the previous lesson covered Razorpay's extra client-side signature check. This lesson closes the loop with the authoritative server-to-server signal: Razorpay webhooks, verified with the exact same HMAC pattern Phase 2 taught, using a secret that is deliberately separate from the key secret Lesson 2 used.

## 1. Verifying the Webhook Signature (Phase 2's Pattern, Razorpay-Specific Secret)

Razorpay signs each webhook payload with HMAC-SHA256 over the raw request body, using a webhook secret you configure separately (in your Razorpay dashboard's webhook settings) from your API key secret. The signature is sent alongside the request in a header — Razorpay documents a specific header name for this, but rather than assert an exact header name here without being fully certain of it, treat it generically as "the signature header Razorpay's webhook docs specify," and confirm the exact name against current Razorpay documentation before wiring up a real endpoint. The verification mechanism itself, though, is exactly Phase 2's general pattern — compute the HMAC over the raw body with the webhook secret, compare in constant time:

```text
1. Razorpay computes: signature = HMAC-SHA256(webhook_secret, raw_request_body)
2. Razorpay sends the raw body + the signature in a header alongside it
3. Your endpoint reads the RAW body bytes (before any JSON parsing)
4. Your endpoint recomputes: expected = HMAC-SHA256(webhook_secret, raw_body_you_received)
5. Your endpoint compares `expected` to the signature Razorpay sent, in constant time
6. Match -> process the event. No match -> reject, do not process.
```

Here's a real, runnable Node.js implementation — the same HMAC logic as Lesson 2, just reused for a webhook body instead of an `order_id`/`payment_id` pair, and using the webhook secret instead of the key secret:

```js
const crypto = require("crypto");

function verifyWebhookSignature(rawBody, webhookSecret, receivedSignature) {
  const expected = crypto.createHmac("sha256", webhookSecret).update(rawBody).digest("hex");
  const expectedBuf = Buffer.from(expected, "hex");
  const receivedBuf = Buffer.from(receivedSignature, "hex");
  if (expectedBuf.length !== receivedBuf.length) {
    return false;
  }
  return crypto.timingSafeEqual(expectedBuf, receivedBuf);
}

const webhookSecret = "test_webhook_secret_xyz789"; // separately configured, NOT the API key secret
const rawBody = JSON.stringify({
  entity: "event",
  event: "payment.captured",
  payload: { payment: { entity: { id: "pay_mock_29QQoUBi66xm2f", amount: 200000, status: "captured" } } },
});

const computed = crypto.createHmac("sha256", webhookSecret).update(rawBody).digest("hex");
console.log("Computed webhook signature:", computed);
console.log("Verify with correct webhook secret:", verifyWebhookSignature(rawBody, webhookSecret, computed));
```

Actual output from running this with `node`:

```text
Computed webhook signature: 3dbebb8bfedb5bb8d8276dd7ae14bc9cc803fdf6eca947bee9426962dd36ed15
Verify with correct webhook secret: true
```

## 2. Webhook Secret vs. API Key Secret (Don't Confuse Them)

Lesson 2's client-side signature check used your Razorpay **key secret** (the same credential used to create Orders server-side). This lesson's webhook check uses a **separately generated webhook secret**, configured specifically for webhook delivery. Razorpay documents these as two distinct secrets serving two distinct verification steps — using the key secret to verify a webhook (or the webhook secret to verify a client-side payment signature) will simply never match, because the two secrets are different values, even though the HMAC mechanism looks identical in both cases. Exactly where in the dashboard the webhook secret is configured can change over time, so confirm that against current Razorpay documentation rather than relying on this lesson for the exact UI path — the important, stable fact is that it's a separate secret from the key secret, not where the button happens to live today.

```js
// Demonstrating the mix-up: verifying a webhook body with the WRONG secret.
const apiKeySecret = "test_key_secret_abc123"; // Lesson 2's secret — wrong one to use here
const wrongComputed = crypto.createHmac("sha256", apiKeySecret).update(rawBody).digest("hex");
console.log("Verify using WRONG secret (API key secret instead of webhook secret):", verifyWebhookSignature(rawBody, webhookSecret, wrongComputed));
```

Actual output from running this with `node`:

```text
Verify using WRONG secret (API key secret instead of webhook secret): false
```

## 3. Key Razorpay Event Types

Razorpay's webhook events map onto the same general categories Phase 2's Lesson 1 described. `payment.captured` and `payment.failed` are commonly documented Razorpay webhook event names for a successful capture and a failed payment attempt, respectively — stated here with reasonably high confidence, but as always, cross-check the full current event list against Razorpay's own docs before depending on an exact event name in production code.

| Category (Phase 2, Lesson 1) | Likely Razorpay Event Name | What It Means |
|---|---|---|
| Payment succeeded | `payment.captured` | A payment was successfully captured |
| Payment failed | `payment.failed` | A payment attempt failed |

## Comparison

| Aspect | Phase 2's general HMAC pattern | Lesson 2's client-side signature check | This lesson's webhook check |
|---|---|---|---|
| Data hashed | Raw request body | `order_id + "|" + payment_id` | Raw webhook request body |
| Secret used | Provider-specific webhook secret | Razorpay key secret | Razorpay webhook secret (separate from key secret) |
| Sent by | Provider's backend | Browser (relaying Checkout's `handler` callback) | Razorpay's backend |
| Authoritative on its own? | Yes (Phase 2's general claim) | No — extra defense, not a replacement | Yes — this is the authoritative signal |
| Comparison method | Constant-time (`crypto.timingSafeEqual`) | Constant-time | Constant-time |

## Common Mistakes

- Using the API key secret (Lesson 2's secret) to verify webhook signatures instead of the separately-generated webhook secret — they are different secrets configured in different places, and using the wrong one makes a genuine webhook fail verification every time, demonstrated concretely above.
- Not handling `payment.failed` events at all — only wiring up the "succeeded" path leaves orders whose payment attempt failed stuck in a pending state forever, since nothing ever tells your system to mark them failed and prompt a retry.
- Hashing a parsed-and-re-serialized body instead of the exact raw bytes Razorpay sent — the same raw-body requirement Phase 2's Lesson 2 and Phase 3's Lesson 3 both already covered, and it applies here unchanged.
- Assuming the webhook secret and key secret can be used interchangeably "since they're both just HMAC secrets" — the HMAC mechanism is identical in shape, but the two secrets are different values tied to different verification steps.

## Hands-On Exercises

1. **Run the webhook verification function.** Save the full script below as `webhook-check.js` and run `node webhook-check.js`:

   ```js
   const crypto = require("crypto");

   function verifyWebhookSignature(rawBody, webhookSecret, receivedSignature) {
     const expected = crypto.createHmac("sha256", webhookSecret).update(rawBody).digest("hex");
     const expectedBuf = Buffer.from(expected, "hex");
     const receivedBuf = Buffer.from(receivedSignature, "hex");
     if (expectedBuf.length !== receivedBuf.length) return false;
     return crypto.timingSafeEqual(expectedBuf, receivedBuf);
   }

   const webhookSecret = "test_webhook_secret_xyz789";
   const rawBody = JSON.stringify({
     entity: "event",
     event: "payment.captured",
     payload: { payment: { entity: { id: "pay_mock_29QQoUBi66xm2f", amount: 200000, status: "captured" } } },
   });

   const computed = crypto.createHmac("sha256", webhookSecret).update(rawBody).digest("hex");
   console.log("Computed webhook signature:", computed);
   console.log("Verify with correct webhook secret and matching signature:", verifyWebhookSignature(rawBody, webhookSecret, computed));

   const apiKeySecret = "test_key_secret_abc123";
   const wrongComputed = crypto.createHmac("sha256", apiKeySecret).update(rawBody).digest("hex");
   console.log("Verify using WRONG secret (API key secret instead of webhook secret):", verifyWebhookSignature(rawBody, webhookSecret, wrongComputed));
   ```

   Actual output from running this with `node`:

   ```text
   Computed webhook signature: 3dbebb8bfedb5bb8d8276dd7ae14bc9cc803fdf6eca947bee9426962dd36ed15
   Verify with correct webhook secret and matching signature: true
   Verify using WRONG secret (API key secret instead of webhook secret): false
   ```

2. **Confirm the correct-secret case.** From the output above, confirm that verifying the webhook body with the correct webhook secret and its own computed signature returns `true`.
3. **Confirm the wrong-secret case.** From the same output, confirm that computing the signature with the API key secret instead of the webhook secret, then verifying it against the webhook secret, returns `false` — this is Common Mistake #1 reproduced concretely.
4. **Paper exercise: which secret goes where?** For each scenario below, write down whether it should use the **key secret** (Lesson 2) or the **webhook secret** (this lesson): (a) verifying the `razorpay_signature` your frontend relays after Checkout's `handler` callback fires; (b) verifying the signature on an incoming `payment.captured` HTTP POST to your webhook endpoint; (c) creating an Order server-side (Lesson 1).

   (Answers: (a) key secret — this is Lesson 2's client-side check. (b) webhook secret — this is this lesson's check. (c) key secret — Order creation, like the client-side signature check, uses your API key credentials, not the webhook secret.)
5. **Add the missing failure path (paper exercise).** Sketch, as pseudocode, a webhook handler's `switch`/`if` block that handles both `payment.captured` (mark order paid) and `payment.failed` (mark order failed, allow retry) — and explain in one sentence what breaks if only the `payment.captured` branch is implemented.

## Interview Q&A

**Q: What secret does Razorpay use to sign webhook payloads, and is it the same secret used in Lesson 2's client-side check?**
A: A separately configured webhook secret — not the same as the API key secret used to create Orders and verify the client-side Checkout signature. The two secrets are distinct values used for distinct checks.

**Q: What's the underlying verification mechanism for a Razorpay webhook?**
A: The same general HMAC-SHA256-over-the-raw-body pattern Phase 2 taught: recompute the signature from the raw bytes received and the webhook secret, then compare to the signature Razorpay sent, using a constant-time comparison.

**Q: If a webhook handler only implements a `payment.captured` branch, what breaks?**
A: Orders whose payment failed never get updated — they stay in whatever pending state they started in indefinitely, since nothing tells the system the payment attempt didn't succeed, and the customer is never prompted to retry.

**Q: Does verifying the webhook signature replace the need for Lesson 2's client-side signature check?**
A: No — they check different things arriving over different paths; the webhook is the authoritative server-to-server signal, while the client-side check is an earlier, additional defense against a forged browser callback. Neither one replaces the other.

**Q: Why would using the key secret to verify a webhook signature always fail, even for a genuine Razorpay webhook?**
A: Because the webhook's signature was computed by Razorpay using the webhook secret, not the key secret — recomputing with a different secret value produces a completely different HMAC output, so the comparison never matches regardless of how genuine the event actually is.
