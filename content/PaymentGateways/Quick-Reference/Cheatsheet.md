# Payment Gateways Cheatsheet

Dense, instant-reference material — condensed from Phases 1-10, organized by what you're trying to do, not by chapter. Every code snippet and fact below is reused verbatim (or condensed without altering meaning) from the phase lesson cited next to it, and verified runnable. Where a lesson itself hedged on exact provider specifics (event names, fee percentages, retry counts), this cheatsheet hedges too, rather than inventing a firmer answer.

---

### The Checkout Flow Shape (Phase 1, Lesson 1)

| Step | What happens | Who does it |
|---|---|---|
| 1. Create | Server creates a payment/order object with `amount` + `currency`, using a secret API key | Server only — never the client, or it can tamper with the amount |
| 2. Collect | Customer's payment method is captured via a hosted widget/iframe/redirect | Client, through provider-hosted UI — raw card data never touches your server |
| 3. Confirm/Capture | Server confirms/captures — this is the only step where money actually moves | Server, then authoritative confirmation via webhook (not the client's "success" screen) |

| Provider | Step 1 object | Step 2 UI | Step 3 confirmation |
|---|---|---|---|
| Stripe | `PaymentIntent` (`POST /v1/payment_intents`) | Stripe Elements / Checkout Session | `payment_intent.succeeded` webhook |
| Razorpay | `Order` (`orders.create`) | Razorpay Checkout hosted widget | Client-side signature check + `payment.captured` webhook |
| PayPal | `Order` (`POST /v2/checkout/orders`) | Smart Buttons | `Order.capture()` + `PAYMENT.CAPTURE.COMPLETED`-style webhook |

---

### PCI Scope Quick Reference (Phase 1, Lesson 2; Phase 8, Lesson 1)

| SAQ Type | When it applies | Burden |
|---|---|---|
| SAQ A | Card data fully outsourced to a hosted field/iframe/redirect; your server never sees raw PAN | Lowest — short questionnaire, no server scans |
| SAQ A-EP | Hosted field in use, but your own page's script could still influence/tamper with it | Moderate — network scans + more controls |
| SAQ D | Your server directly receives/stores/transmits raw PAN (custom card form) | Highest — full requirement set, often a QSA audit |

**Compliance Level (1-4) vs. SAQ type are independent axes** (Phase 8, Lesson 1): Level is volume-based (assigned by card networks, drives how rigorous validation must be); SAQ type is architecture-based (drives which infrastructure is actually in scope). A huge Level 1 merchant using only hosted checkout can still be SAQ A.

---

### Webhook Signature Verification — General HMAC Pattern (Phase 2, Lesson 2)

```text
1. Provider computes: signature = HMAC-SHA256(secret, raw_request_body)
2. Provider sends the raw body + signature in a header
3. Your endpoint reads the RAW body bytes (before any JSON parsing)
4. Your endpoint recomputes: expected = HMAC-SHA256(secret, raw_body_you_received)
5. Compare `expected` to the received signature, in CONSTANT TIME
6. Match -> process. No match -> reject, do not process.
```

Node implementation (Phase 2, Lesson 2):

```js
const crypto = require("crypto");

function computeSignature(rawBody, secret) {
  return crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
}

function verifySignature(rawBody, secret, receivedSignature) {
  const expected = computeSignature(rawBody, secret);
  const expectedBuf = Buffer.from(expected, "hex");
  const receivedBuf = Buffer.from(receivedSignature, "hex");
  if (expectedBuf.length !== receivedBuf.length) {
    return false; // timingSafeEqual throws on mismatched lengths — check first
  }
  return crypto.timingSafeEqual(expectedBuf, receivedBuf);
}
```

Example: `verifySignature(rawBody, secret, receivedSignature)` → `true` for an untampered payload, `false` for a tampered one.

**Why `crypto.timingSafeEqual` and not `===`**: plain string comparison can return faster on an early mismatch than a late one, creating a timing side-channel; `timingSafeEqual` runs in constant time regardless of where buffers differ. Always length-check first — it throws on mismatched lengths.

**Golden rule**: hash the raw bytes, never `JSON.stringify(JSON.parse(rawBody))` — re-serializing can change whitespace/key order/number formatting and silently break a genuinely valid signature.

#### Per-Provider Webhook Verification

| Provider | Mechanism | Secret used | Network call required? |
|---|---|---|---|
| Stripe (Phase 3, Lesson 3) | `stripe.webhooks.constructEvent(rawBody, sigHeader, endpointSecret)` — wraps the same HMAC pattern | Webhook signing secret (`STRIPE_WEBHOOK_SECRET`) | No — local HMAC |
| Razorpay (Phase 4, Lesson 3) | Hand-rolled HMAC-SHA256 over raw body, same pattern as above | Separately-configured **webhook secret** — NOT the key secret used for Orders/client-side check | No — local HMAC |
| PayPal (Phase 5, Lesson 3) | POST received headers + raw body + webhook id to PayPal's own verification API endpoint | OAuth bearer access token (Lesson 1) | **Yes** — an authenticated API call; failure can mean forged signature OR a network/auth problem, a distinction Stripe/Razorpay don't have |

**Common mistake across all three**: applying a global JSON body-parser before the webhook route, which consumes/reserializes the body before the raw bytes can be hashed — verification then fails even for a genuine event. Mount raw-body parsing only on the webhook route.

---

### Razorpay Client-Side Signature Formula (Phase 4, Lesson 2)

This is Razorpay's *extra* check — in addition to, not instead of, webhook verification. Verifies the payment ID/order ID pair the browser relays from Checkout's `handler` callback.

```text
expected_signature = HMAC-SHA256(key_secret, order_id + "|" + payment_id)
```

Node implementation (Phase 4, Lesson 2):

```js
const crypto = require("crypto");

function computeExpectedSignature(order_id, payment_id, secret) {
  return crypto
    .createHmac("sha256", secret)
    .update(order_id + "|" + payment_id)
    .digest("hex");
}
```

Example: `computeExpectedSignature("order_mock_9A33XWu170gUtm", "pay_mock_29QQoUBi66xm2f", "test_key_secret_abc123")` → `78c348ed1387ec59fc5be0a02cd565cdae0f131081791add33539aaf4ba73b94`.

**Common mistake**: swapping the concatenation order (`payment_id + "|" + order_id`) — produces a completely different, silently-wrong signature with no obvious error. Compare with `crypto.timingSafeEqual`, same as any other HMAC check.

**Never confuse the two Razorpay secrets**: the client-side check uses your **key secret** (same one used to create Orders); the webhook check uses a separately-configured **webhook secret**. Using either one for the other's check always fails, even for a genuine event.

---

### Minor-Unit Currency Conversion (Phase 9, Lesson 1)

General rule: multiply by `10^decimalPlaces` for that currency — NOT always by 100.

```js
function toMinorUnits(amount, decimalPlaces) {
  const factor = Math.pow(10, decimalPlaces);
  return Math.round(amount * factor); // Math.round avoids float artifacts (19.99*100 = 1998.9999...)
}
```

| Currency | Decimal places | Multiplier | Example |
|---|---|---|---|
| USD | 2 | 100 | $20.00 → `2000` |
| EUR | 2 | 100 | €19.99 → `1999` |
| INR | 2 | 100 | ₹2,000.00 → `200000` (paise) |
| JPY | 0 | 1 | ¥500 → `500` (NOT `50000`) |
| BHD | 3 | 1000 | BHD 1.500 → `1500` |
| KWD | 3 | 1000 | KWD 2.750 → `2750` |

**Zero-decimal currencies** (JPY, and commonly KRW — confirm KRW against your specific provider's docs): sending the ×100 amount overcharges by 100x. **Three-decimal currencies** (BHD, KWD — both subdivide into fils): the standard ×100 assumption undercharges by 10x.

**Provider representation differs, not just the multiplier** (Phase 9, Lesson 1): Stripe and Razorpay both take an integer minor-unit count; PayPal's Orders v2 API takes a **decimal string** (e.g. `"20.00"`), not an integer — the multiplication step doesn't even apply the same way there.

---

### OAuth2 Client-Credentials Token Caching (Phase 5, Lesson 1 — PayPal)

Only PayPal in this course requires an OAuth2 hop before API calls; Stripe and Razorpay use static keys directly on every request. The caching *decision* is pure logic, no network dependency — Node implementation (Phase 5, Lesson 1):

```js
function createTokenCache() {
  let cachedToken = null;
  let expiresAt = 0; // ms since epoch

  return {
    getToken(now, getFreshTokenFromProvider) {
      const SAFETY_MARGIN_MS = 30 * 1000; // refresh a little early

      if (cachedToken && now < expiresAt - SAFETY_MARGIN_MS) {
        return { token: cachedToken, source: "cache", expiresAt };
      }

      const fresh = getFreshTokenFromProvider();
      cachedToken = fresh.access_token;
      expiresAt = now + fresh.expires_in_ms;
      return { token: cachedToken, source: "network", expiresAt };
    },
  };
}
```

Example: cold start → `{ token: 'mock_token_1', source: 'network' }`; called again while still within lifetime → `{ token: 'mock_token_1', source: 'cache' }`; called past the safety margin → fetches fresh again.

**Rules**: fetch once per token lifetime, not per API call. Build in a safety margin (e.g. 30s) before real expiry rather than refreshing at the exact expiry instant. Read `expires_in` from the response — don't hardcode an assumed duration. PayPal's webhook verification (above) also depends on this same cached token, so an expired/uncached token can make verification fail for reasons unrelated to the signature itself.

---

### At-Least-Once Delivery & Idempotency (Phase 1, Lesson 3; Phase 2, Lesson 3)

| Concern | Fix | Provider support |
|---|---|---|
| Retried checkout/charge request after a timeout | Client-generated idempotency key, reused across retries of the *same* logical operation, never regenerated per retry | Stripe: `Idempotency-Key` header (~24h). PayPal: `PayPal-Request-Id` header. **Razorpay: no general-purpose idempotency key on Orders/Payments** — only `X-Payout-Idempotency`, and that's scoped to RazorpayX Payouts only. A timed-out Razorpay order/payment call must be resolved by GETting the order's status, not blind retry. |
| Webhook redelivered (at-least-once, not exactly-once) | Dedupe by the event's unique ID in a persistent store (survives restarts); skip if already seen | Same pattern across all providers — dedupe key must be the event ID, never order ID (a `payment.succeeded` and a later `refund.issued` legitimately share an order ID) |
| Slow synchronous work delays the 2xx response | Verify signature → dedupe → enqueue work → return 2xx fast, do the slow work async | Universal — a delayed 2xx looks like a failure to the provider and triggers a redelivery |

---

### HTTP Status / Error-Handling Conventions (General Guidance — Hedge on Exact Codes)

No phase lesson asserted specific per-provider HTTP status code tables as verified fact, so treat the below as general conventions to confirm against live docs, not memorized specifics:

- A signature verification failure should be rejected outright (commonly modeled as a 4xx in examples in this course, e.g. Stripe's handler returning 400) — never logged-and-continued.
- A webhook handler's own 2xx is what stops provider redelivery; a thrown/uncaught error or timeout before that response is sent looks identical to a dropped request from the provider's point of view and triggers a retry.
- PayPal's webhook-verification call itself can fail two structurally different ways: a definitive "signature invalid" result (reject, never retry) vs. a network/auth failure reaching PayPal's endpoint (may warrant a retry/5xx rather than treating it as forgery) — Phase 5, Lesson 3's key distinction.
- Exact provider-specific decline/error code lists (card declined reason codes, dispute reason codes, etc.) were not asserted in this course — pull the current list from each provider's live API reference before building logic that branches on specific codes.

---

### Refunds (Phase 7, Lesson 1)

- Full refund: entire charge amount in one call. Partial refund: less than the full charge; a charge can have **multiple** partial refunds, cumulative sum must never exceed the original amount — enforce this server-side yourself, don't rely solely on the provider rejecting an over-refund.
- A refund API call returning 200 means the refund was **initiated**, not completed — real money movement depends on bank/card-network processing time (commonly days). Confirm completion via the refund webhook (e.g. Stripe's `charge.refunded`), same "webhook is authoritative" rule as payments.

### Disputes vs. Chargebacks (Phase 7, Lessons 2-3)

- **Dispute**: provider-mediated, merchant gets a structured evidence window before resolution. **Chargeback**: bank-initiated via the card network directly, merchant recourse typically more limited/procedural.
- Only `charge.dispute.created` (Stripe) is verified as a concrete event name in this course; Razorpay/PayPal equivalents were explicitly hedged — confirm against live docs.
- Missing the evidence window's deadline typically auto-resolves in the customer's favor. Model `dispute` as a distinct status from `refund` in your schema — one is merchant-initiated, the other is customer/bank-initiated.

### Subscriptions (Phase 6)

- Shared state shape across all three providers: `trialing → active → past_due → (recovered to active) | (retries exhausted → unpaid/canceled)`. `past_due` is alive-and-retriable, not the same as `canceled` — don't revoke access on the first failed renewal.
- Proration formula (Phase 6, Lesson 2): `fractionRemaining = daysRemaining / totalDaysInCycle`; `unusedCredit = oldPrice * fractionRemaining`; `newPlanCharge = newPrice * fractionRemaining`; `netAmount = newPlanCharge - unusedCredit`. Compute `daysRemaining` from the provider's actual current-period-end field, not a locally-computed "today."
- Dunning: retry a failed renewal on a backoff schedule before canceling; exact retry counts/spacing are provider-configurable and not asserted as fixed facts — send your own app-level notifications regardless of provider retries, and add a grace period after "retries exhausted" before hard-canceling.

---

### Settlement vs. Presentment Currency (Phase 9, Lesson 3)

- **Presentment currency**: what the customer sees/is charged in at checkout. **Settlement currency**: what lands in the merchant's bank account. Often the same; diverge whenever selling in a currency the payout account isn't denominated in.
- Shape of the conversion (illustrative numbers, not real provider rates): `converted = presentmentAmount * exchangeRate; fee = converted * (feePercent/100); settlement = converted - fee`.
- Multi-currency payout accounts avoid conversion (and its fee) only for currencies with a matching dedicated account — every other presentment currency still falls back to conversion.

---

### Provider Choice at a Glance (Phase 9, Lesson 2; Phase 10, Lesson 1)

| Factor | Stripe | Razorpay | PayPal |
|---|---|---|---|
| Regional strength | Broad global, strong US/EU | India-first — deep UPI/net-banking support | Broad global + established buyer base |
| Auth model | Static secret/publishable keys | Static key ID + key secret | OAuth2 client-credentials grant (real extra engineering cost) |
| Webhook verification | Local HMAC via SDK helper | Local HMAC, hand-rolled | API round-trip to PayPal, auth-dependent |
| Amount representation | Integer minor units | Integer minor units (paise) | Decimal string (Orders v2) |
| Idempotency | `Idempotency-Key` header | No general-purpose key on Orders/Payments | `PayPal-Request-Id` header |

Choose by market fit and integration-complexity fit first, fee percentage last — a marginally cheaper provider missing a market's preferred payment method (e.g. UPI) typically costs more in lost conversion than it saves in fees.

---

### Testing & Monitoring Checklist (Phase 10, Lessons 2-3)

Minimum pre-production test matrix: happy path, card decline, 3DS challenge (`requires_action`-style status, not a binary succeeded/failed), webhook redelivery (idempotency), refund (confirmed via webhook, not just the API's 200).

Production monitoring signals worth alerting on: webhook receipt rate vs. a rolling baseline, signature-verification failure rate (a spike can mean a rotated secret), handler error rate *after* verification succeeds (separate from the initial 2xx). Back it all with a reconciliation job that polls the provider's API for orders stuck `pending` past a threshold — this is the only safety net for a webhook that never arrives at all.

Verified Stripe test cards (Phase 1, Lesson 3) — no equivalent test numbers were asserted for Razorpay or PayPal in this course; pull those from each provider's live sandbox docs:

```text
4242 4242 4242 4242   -> always succeeds
4000 0000 0000 0002   -> generic decline
4000 0000 0000 9995   -> insufficient funds decline
```
