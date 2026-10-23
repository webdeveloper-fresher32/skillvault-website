# Test Mode and Idempotency Keys

Every provider gives you a sandbox to build against without moving real money, and every provider gives you a way to make retried requests safe. Both are foundational: you'll use test mode every day during development, and you'll rely on idempotency keys the moment your integration has to survive a flaky network.

## 1. Test Mode and Test API Keys

Providers issue a separate pair of API keys for test/sandbox mode — requests made with a test key never touch real card networks or move real money, even though the API responses look identical in shape to production. Alongside test keys, each provider publishes a set of test card numbers that deterministically simulate outcomes like a successful charge, a decline, or an insufficient-funds error, so you can exercise every code path without needing real cards.

```text
Stripe test key prefix:    sk_test_...   (secret)   pk_test_...   (publishable)
Razorpay test key prefix:  rzp_test_...
PayPal:                    separate "Sandbox" app credentials in the Developer Dashboard

Common Stripe test cards:
  4242 4242 4242 4242   -> always succeeds
  4000 0000 0000 0002   -> always declines (generic decline)
  4000 0000 0000 9995   -> declines with "insufficient funds"
```

## 2. Idempotency Keys

An idempotency key is a unique value your client generates and attaches to a request (typically as a header, e.g. `Idempotency-Key`), so that if the same logical request is sent more than once — say, after a network timeout where you don't know if the first attempt succeeded — the provider recognizes the duplicate and returns the original result instead of creating a second charge. The key must be generated once per logical operation and reused across every retry of that same operation.

Not every provider offers this safety net for every API, though. Stripe honors `Idempotency-Key` broadly across most write operations, and PayPal honors `PayPal-Request-Id` on Orders API calls — but Razorpay's only documented idempotency mechanism is the `X-Payout-Idempotency` header, and it applies solely to RazorpayX Payout creation, not to standard Order/Payment creation. If you're building a Razorpay checkout flow (the exact flow this lesson covers) and a create-order or create-payment request times out, you cannot just resend it with the same key and trust the server to dedupe it — because there is no key-based dedupe on that endpoint. Instead you have to check the order/payment status first (e.g. `GET` the order and inspect its state) before deciding whether it's safe to retry.

```js
const crypto = require("crypto");

function createIdempotencyKey() {
  return crypto.randomUUID();
}

const key = createIdempotencyKey();
console.log("Generated idempotency key for this logical request:", key);
```

Actual output from running this with `node`:

```text
Generated idempotency key for this logical request: 80a476be-6f49-49da-9bfe-30efec38e331
```

## 3. What Happens Without One (the Duplicate-Charge Bug)

Without an idempotency key, a timed-out request is genuinely ambiguous: did the charge succeed on the provider's side before the response was lost, or did it never reach the provider at all? Naively retrying without a shared key means the provider treats the retry as a brand-new charge — if the first attempt actually did succeed, the customer is now charged twice.

```js
// Simulates a server that deduplicates requests by idempotency key.
const processedRequests = new Map(); // key -> stored response

function chargeServer(idempotencyKey, amount) {
  if (processedRequests.has(idempotencyKey)) {
    console.log(`[server] Key ${idempotencyKey} already processed - returning STORED result, no new charge created`);
    return processedRequests.get(idempotencyKey);
  }
  const charge = { id: "ch_" + Math.random().toString(36).slice(2, 8), amount, status: "succeeded" };
  processedRequests.set(idempotencyKey, charge);
  console.log(`[server] Key ${idempotencyKey} is new - creating charge`, charge);
  return charge;
}
```

Running the full simulation (client times out, then retries with the SAME key) produces this real output:

```text
First attempt (network is fine):
[server] Key a79c36eb-2e96-42ae-bb07-f811a074675e is new - creating charge { id: 'ch_e5q7ry', amount: 2000, status: 'succeeded' }

Client times out waiting for response, retries with the SAME key:
[server] Key a79c36eb-2e96-42ae-bb07-f811a074675e already processed - returning STORED result, no new charge created

Same charge object returned both times? true
Only one charge exists on the server: true
```

## Comparison

| Provider | Test-Mode Key Prefix | Idempotency Key Mechanism |
|---|---|---|
| Stripe | `sk_test_...` / `pk_test_...` | `Idempotency-Key` HTTP header, client-generated, honored for 24 hours |
| Razorpay | `rzp_test_...` | `X-Payout-Idempotency` header — but only on RazorpayX Payout APIs; standard Order/Payment creation has **no** documented idempotency-key support |
| PayPal | Sandbox app Client ID/Secret (Developer Dashboard) | `PayPal-Request-Id` header on Orders API calls |

## Common Mistakes

- Generating a **new** idempotency key on every retry attempt — this defeats the entire purpose, since the provider now sees each retry as a distinct request and may create duplicate charges. The key must be generated once per logical operation and reused for every retry of that same operation.
- Using test-mode API keys in a mixed-mode environment (e.g., a staging server with a production database) without realizing test-mode webhooks are sent to whatever endpoint is configured in the test-mode dashboard — they will not fire to your production webhook URL, which can look like "webhooks are broken" when really it's a test/live mode mismatch.
- Reusing the same idempotency key across genuinely different logical requests (e.g., two separate orders) — this causes the second, unrelated request to incorrectly receive the first one's cached result.
- Forgetting to set an expiration/cleanup policy for your own idempotency-key storage (if you're deduplicating server-side too), causing unbounded growth of a keys table.
- Assuming idempotency keys protect against all forms of duplicate submission (e.g., a user double-clicking "Pay" before your client even generates a key) — the key only helps once it's attached to a specific outgoing request; the client still needs to disable the button or reuse one key across the double-click.
- Assuming Razorpay's Orders/Payments API has the same idempotency-key safety net as Stripe or PayPal — it doesn't. Razorpay's `X-Payout-Idempotency` header only covers RazorpayX Payouts, so a timed-out order/payment creation call must be handled by checking the order's status before retrying, not by blindly resending with a "shared key."

## Hands-On Exercises

1. **Generate and verify a key.** Save and run this with `node`:

   ```js
   const crypto = require("crypto");
   function createIdempotencyKey() {
     return crypto.randomUUID();
   }
   const key = createIdempotencyKey();
   console.log("key:", key);
   console.log("same key reused:", key === key);
   ```

   Confirm the output prints a valid UUID and `same key reused: true`.

2. **Prove reuse vs. regeneration differ.** Run:

   ```js
   const crypto = require("crypto");
   const reusedKey = crypto.randomUUID();
   const retries = [reusedKey, reusedKey, reusedKey]; // correct: same key each retry
   const buggyRetries = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()]; // wrong: new key each time
   console.log("correct retries all equal:", new Set(retries).size === 1);
   console.log("buggy retries all equal:", new Set(buggyRetries).size === 1);
   ```

   Expect `correct retries all equal: true` and `buggy retries all equal: false` — this is the observable difference between correct and incorrect idempotency-key usage.

3. **Simulate the dedup server.** Run the `chargeServer` simulation from this lesson twice with the same key and confirm only one entry ever lands in `processedRequests` (check `processedRequests.size === 1` after both calls).

4. **Break it on purpose.** Modify the simulation to call `chargeServer` with a freshly generated key on the "retry," instead of reusing the original key, and observe that `processedRequests.size` becomes `2` — this reproduces the duplicate-charge bug in miniature.

5. **Test-card exercise.** Using Stripe's documented test cards (no live account needed — just read the docs), write down which test card number you'd use to verify your error-handling code correctly surfaces an "insufficient funds" decline to the user.

## Interview Q&A

**Q: What problem do idempotency keys solve?**
A: They make retried requests safe after ambiguous failures (like a network timeout) by letting the provider recognize "this is the same logical request as before" and return the original result instead of creating a duplicate charge.

**Q: When should a client generate a new idempotency key?**
A: Once per distinct logical operation — e.g., once per checkout attempt — and it must reuse that same key for every retry of that specific attempt, never generating a fresh one per retry.

**Q: Why might a webhook silently "not work" in a staging environment?**
A: If staging is calling the provider with a test-mode API key, but the webhook endpoint configured is the production/live-mode one, the test-mode events are sent to the test-mode webhook config, not the production one — it's a mode mismatch, not a broken webhook.

**Q: Are test-mode charges real money movements?**
A: No — test-mode API keys route requests so that no real card networks or bank rails are touched, regardless of what card number or amount is used.

**Q: If two different orders accidentally reuse the same idempotency key, what happens?**
A: The provider treats the second order's request as a duplicate of the first and returns the first order's cached result, which is incorrect and can cause the second order to appear to succeed without actually being charged/created as intended.
