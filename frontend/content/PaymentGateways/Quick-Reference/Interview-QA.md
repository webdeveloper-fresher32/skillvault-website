# Payment Gateways Interview Q&A

50 questions, grouped by phase range. Every answer is consistent with what the corresponding phase lesson actually taught — where a lesson hedged on a specific fact (exact fee percentages, exact retry counts, non-Stripe event names), the answer here hedges too rather than asserting something firmer.

---

## Q1-15: Fundamentals & Webhooks (Phases 1-2)

**Q1: Why must the payment/order object be created server-side instead of client-side?**
A: Because that object carries the amount and currency; if the client could create it, the client could also set those values, letting a tampered request change the price charged. The server is the only party that knows the true price of a cart.

**Q2: What are the three steps every provider's checkout flow reduces to, regardless of vocabulary?**
A: (1) Server creates a payment/order object with amount and currency. (2) Client collects the payment method through a hosted widget/iframe/redirect, so raw card data never touches the server. (3) Server confirms/captures — this is the only step where money actually moves.

**Q3: Is a client-side "payment successful" redirect ever enough to mark an order as paid in your database?**
A: No — it should only drive UI state. The redirect only proves the browser reached a URL; it can be skipped (closed tab, dropped network), forged, or fired without a real payment behind it. The database should only be updated from a server-to-server webhook.

**Q4: What single fact determines whether your server falls into full PCI scope?**
A: Whether your server ever receives, processes, stores, or transmits the raw Primary Account Number (PAN) — even briefly. If it does, you're in full scope (SAQ D); if hosted fields keep raw PAN off your server entirely, you qualify for the minimal SAQ A.

**Q5: What's the practical difference between SAQ A and SAQ A-EP?**
A: Both keep raw PAN off your server via a hosted field/iframe. SAQ A-EP applies when your own page's script could still influence or tamper with that payment form; SAQ A requires that your page's other code has no bearing on it at all.

**Q6: What problem do idempotency keys solve?**
A: They make retried requests safe after an ambiguous failure (like a network timeout) — the provider recognizes "this is the same logical request as before" by the shared key and returns the original result instead of creating a duplicate charge.

**Q7: When should a client generate a new idempotency key?**
A: Once per distinct logical operation (e.g. once per checkout attempt), and it must reuse that exact same key for every retry of that specific attempt — never generate a fresh key per retry, or the provider sees each retry as a new request.

**Q8: Why can't you trust a client-side redirect as proof a payment succeeded?**
A: The redirect only tells you the browser reached a URL — it doesn't run on the provider's servers, so it can fail to fire (closed tab, dropped network) even when the payment actually succeeded on the provider's side, or be reachable without any real payment behind it.

**Q9: What makes a webhook more trustworthy than a redirect?**
A: It's sent server-to-server, directly from the provider's backend to yours, independent of the customer's browser or network staying alive — it reflects what actually happened in the provider's own system of record.

**Q10: What does verifying a webhook signature actually prove?**
A: That the request body was signed by someone holding the shared secret (presumably the provider) and that the body wasn't altered after signing. It does not, by itself, prove anything about network-level identity or that the event hasn't been seen before.

**Q11: Why must you hash the raw request body instead of a parsed-and-re-serialized version of it?**
A: Parsing and re-serializing can change whitespace, key order, or number formatting, producing different bytes than what the provider originally signed — hashing those different bytes yields a different signature, so a genuinely valid webhook would incorrectly fail verification.

**Q12: Why use `crypto.timingSafeEqual` instead of `===` to compare signatures?**
A: `===` on strings can return faster when an early character mismatches than when only a late character mismatches, creating a timing side-channel that could in principle let an attacker infer the correct signature byte by byte. `timingSafeEqual` takes constant time regardless of where the difference is.

**Q13: What does "at-least-once delivery" mean, and why do providers design webhooks this way?**
A: Your endpoint is guaranteed to eventually receive every event, but may receive some more than once. Providers prefer an occasional duplicate over silently dropping an event when your server has a bad moment (timeout, crash, deploy).

**Q14: How do you make a webhook handler idempotent?**
A: Track the unique event ID of every event you've successfully processed, in a persistent store (survives restarts), and check incoming events against that store before doing any work — skip processing if the ID has been seen before.

**Q15: Why shouldn't a webhook handler do slow synchronous work before responding?**
A: If slow work (API calls, heavy DB writes) delays the response past the provider's timeout window, the provider treats it as a failed delivery and retries — recreating the exact redelivery scenario the handler already has to be idempotent against, and doing it repeatedly under load.

---

## Q16-30: Provider-Specific — Stripe, Razorpay, PayPal (Phases 3-5)

**Q16: What is a Stripe PaymentIntent, and what's its status progression for a straightforward successful payment?**
A: It's Stripe's server-created "payment object" holding amount and currency. Its status moves `requires_payment_method` → `requires_confirmation` → `processing` → `succeeded` (with `requires_action` as a branch for extra authentication).

**Q17: Why do Stripe Checkout Sessions reduce PCI scope even more than Stripe Elements does?**
A: Stripe hosts the entire checkout page itself, not just an iframe embedded within your page — there's no page of yours involved in rendering the payment form at all, so no unrelated script on your page can ever be judged to interfere with it.

**Q18: What header does Stripe send its webhook signature in, and what does the SDK's verification helper do?**
A: The `Stripe-Signature` header; `stripe.webhooks.constructEvent(rawBody, signatureHeader, endpointSecret)` recomputes and compares the signature internally using the same general HMAC pattern, returning the parsed event on success or throwing on failure.

**Q19: Why can't you just develop and test a Stripe webhook handler against `localhost` with no other tooling?**
A: Stripe's servers need a publicly reachable URL to deliver the webhook to, and `localhost` isn't reachable from the public internet — some tunneling/forwarding tool (or Stripe's own CLI) is needed to route test-mode events to your machine.

**Q20: Why must a Razorpay Order's `amount` be expressed in paise rather than rupees?**
A: Razorpay's API expects an integer in the smallest currency unit — paise, where 100 paise = 1 rupee — the same reason Stripe expects cents. Passing a rupee-denominated integer directly undercharges by a factor of 100.

**Q21: What three values does Razorpay Checkout's `handler` callback give the client after a payment, and how is the expected signature computed?**
A: A payment ID, the order ID, and a signature. The expected signature is `HMAC-SHA256(key_secret, order_id + "|" + payment_id)` — concatenated with a pipe, in that exact order.

**Q22: Is verifying Razorpay's client-side signature enough on its own, without also verifying the webhook?**
A: No — it's an additional, earlier defense against a forged client callback, not a replacement for webhook verification. The webhook remains the authoritative server-to-server signal; skipping it because the client-side check passed reintroduces the exact client-trust problem webhooks exist to close.

**Q23: What secret does Razorpay use to sign webhook payloads, and is it the same one used for the client-side signature check?**
A: A separately-configured webhook secret — not the same as the API key secret used to create Orders and verify the client-side Checkout signature. Using the wrong secret for either check always fails, even for a genuine event.

**Q24: Why does PayPal require an OAuth2 token exchange when Stripe and Razorpay don't?**
A: PayPal's server-side APIs authenticate calls with a short-lived bearer access token rather than a long-lived static key sent directly on every request. The client-credentials grant is how your server exchanges its client ID and secret for that token.

**Q25: Why shouldn't you fetch a new PayPal access token on every API call?**
A: The token remains valid for an extended period (typically several hours), so fetching a new one every call wastes a network round-trip and adds an avoidable failure point to every single request — caching the token until it's near expiry avoids both.

**Q26: Why build in a safety margin before a cached token's actual expiry, instead of refreshing exactly at expiry?**
A: A request that begins using the cached token just before its exact expiry could have the token die mid-flight. Refreshing slightly early (e.g. 30 seconds before expiry) avoids handing out a token that's about to become invalid.

**Q27: What are the three explicit steps in PayPal's Orders v2 flow, and what happens if the last one is skipped?**
A: Create (server creates the order), approve (buyer approves via Smart Buttons/PayPal's UI), and capture (server calls a separate endpoint that actually moves funds). If capture is never called, the order sits approved-but-uncaptured indefinitely — no money has moved, no matter what the client-side UI shows.

**Q28: How does PayPal's webhook signature verification differ from Stripe's or Razorpay's?**
A: Stripe and Razorpay both verify with a purely local HMAC recompute-and-compare, no network call required. PayPal instead sends the received headers, raw body, and webhook id to a PayPal API endpoint, authenticated with an OAuth bearer token, and trusts PayPal's own response about validity.

**Q29: Name two distinct reasons a PayPal webhook verification attempt could fail that wouldn't apply to Stripe or Razorpay.**
A: A network error or outage reaching PayPal's verification endpoint, or an authentication failure due to an expired/missing OAuth access token — both are network/auth failures unrelated to whether the signature itself is genuine, a failure mode that doesn't exist for Stripe's or Razorpay's purely local checks.

**Q30: Does every payment provider represent amounts as an integer in the currency's minor unit?**
A: Not universally — Stripe and Razorpay do, but PayPal's Orders v2 API takes the amount as a decimal string (e.g. `"20.00"`) rather than an integer count of minor units, so the exact representation still needs to be confirmed per provider.

---

## Q31-40: Subscriptions, Refunds & Disputes (Phases 6-7)

**Q31: Why is `past_due` a distinct subscription state instead of just treating the subscription as unpaid/inactive?**
A: A `past_due` subscription is still alive and retriable — the charge failed but the provider (and often the app) will try again, and many products intentionally keep access on during this window. Collapsing it into "inactive" causes premature access revocation for a customer whose card may simply need updating.

**Q32: If a subscription's trial ends, does that always mean the first payment succeeded?**
A: No — a trial can also end because no valid payment method is on file, which routes the subscription into a failure/retry state instead of `active`. The trial-to-active transition should only be trusted for subscriptions where the "first charge succeeded" event actually fired.

**Q33: What's the core proration formula for a mid-cycle plan change?**
A: `fractionRemaining = daysRemaining / totalDaysInCycle`, then `unusedCredit = oldPrice * fractionRemaining`, `newPlanCharge = newPrice * fractionRemaining`, and `netAmount = newPlanCharge - unusedCredit` — positive means charge the customer, negative means credit them.

**Q34: Why is it risky to compute `daysRemaining` from "today" on a wall clock instead of from the provider's actual current-period-end field?**
A: Clock skew, timezone handling, or a delayed webhook can make a locally-computed "days until renewal" drift from what the provider's system actually considers the cycle boundary, producing an incorrect proration even though the formula itself is correct.

**Q35: What is dunning, and why shouldn't an app rely solely on the provider's built-in retry logic for it?**
A: Dunning is retrying a failed recurring charge on a backoff schedule before giving up. Relying only on the provider's retries leaves the customer with no notification of why their card is being retried, and leaves the app not reacting to the "retries exhausted" terminal event — the app still needs to send its own notifications and decide what happens next (e.g. a grace period).

**Q36: What's the difference between a full and a partial refund, and what constraint applies across both?**
A: A full refund returns the entire charge amount in one call; a partial refund returns a specified amount less than the full charge, and a single charge can have multiple partial refunds issued against it over time — as long as their cumulative sum never exceeds the original charge amount.

**Q37: Does a refund API call returning 200 mean the customer has their money back?**
A: No — it means the provider accepted and is processing the refund request. The money reaching the customer's account depends on real-world bank/card-network processing time, which is not instant. Refund completion should be confirmed via the provider's refund webhook, not the synchronous API response.

**Q38: What's the practical difference between a dispute and a chargeback?**
A: A dispute is provider-mediated — the customer contacts the provider or their bank first, the provider notifies the merchant, and the merchant gets a structured window to submit evidence before resolution. A chargeback is bank-initiated — the customer's bank reverses the charge directly through the card network, typically with more limited and more procedural merchant recourse.

**Q39: What happens if a merchant never responds to a dispute within the evidence window?**
A: It's typically auto-resolved in the customer's favor — the merchant loses the disputed amount (and often a separate dispute fee) by default, simply by missing the deadline, regardless of whether the underlying evidence would have won the case.

**Q40: Why is only handling a dispute's "opened" webhook event not enough?**
A: Because the dispute doesn't end there — it later resolves as won or lost on the provider's side. If the app never handles the terminal "closed" event, its internal state stays stuck at "needs response" indefinitely, even though the real case has already concluded.

---

## Q41-50: Security, Currency & Production (Phases 8-10)

**Q41: What's the core difference between a PCI compliance Level and a SAQ type?**
A: Level is a volume-based bucket (1-4) assigned by card networks based on annual transaction count, driving how rigorous your validation process must be. SAQ type is an architecture-based classification (A/A-EP/D) driven by how cardholder data actually flows through your systems. The two are independent axes.

**Q42: What does a payment token represent, and can it be used across a different provider than the one that issued it?**
A: It's an opaque, provider-generated identifier standing in for a payment method the customer already provided once; it does not contain the raw card number, which the provider holds. Tokens are not portable — a token from Provider A means nothing to Provider B, so switching providers requires every customer to re-enter their payment method.

**Q43: What metadata should be stored alongside a saved payment token, and why?**
A: Enough display information — typically card brand, last 4 digits, and expiry — so the application can show the customer which saved card they're using without making a live API call to the provider every time the account page loads.

**Q44: What is 3D Secure, mechanically, and why does it exist for EU/UK transactions specifically?**
A: It's an additional authentication step controlled by the card issuer's bank — typically a redirect to a bank-hosted page requesting a one-time code or biometric confirmation — inserted before the issuer approves the charge. It exists because of Strong Customer Authentication (SCA) under the EU/UK's PSD2 regulation; exact scope and exemptions are regulatory and should be verified with current documentation rather than assumed.

**Q45: What's the risk of only testing the happy path (no 3DS challenge) during development?**
A: Code that assumes every confirmation call resolves directly to success or a hard failure will mishandle the `requires_action` (or equivalent) branch in production, silently breaking for the subset of real customers — often EU/UK cardholders — whose issuer requires the extra challenge.

**Q46: Why does "multiply by 100" break for some currencies, and name one example in each direction?**
A: Because the correct multiplier is 10 raised to that currency's ISO 4217 decimal-place count, not always 2. JPY has 0 decimal places, so multiplying by 100 overcharges by 100x (sending 50000 instead of 500 for ¥500). BHD has 3 decimal places, so multiplying by only 100 undercharges by 10x (sending 150 instead of 1500 for BHD 1.500).

**Q47: What's the difference between presentment currency and settlement currency?**
A: Presentment currency is what the customer sees and is charged in at checkout; settlement currency is what actually arrives in the merchant's payout/bank account. They're often the same, but diverge whenever a merchant sells in a currency their payout account isn't denominated in — the provider then converts, typically deducting a conversion fee.

**Q48: How would you choose between Stripe, Razorpay, and PayPal for a new product?**
A: Not by fee percentages alone — start with target-market fit (Razorpay for India-first products given its native UPI/local-rail support; Stripe/PayPal for broader global or US/EU reach), then check feature and integration-complexity fit for the product's specific needs (subscriptions, dispute volume, PayPal's added OAuth2 setup cost), and only then compare fee structures, since all three follow a similar percentage-plus-fixed-fee shape.

**Q49: How would you monitor payment webhook health in production?**
A: Track receipt rate against a rolling baseline, signature-verification failure rate, and downstream handler error rate as three separate metrics — a spike in any one points to a different root cause (provider outage, a rotated secret, or a broken background job respectively), none of which are visible from the client-side success screen alone.

**Q50: What happens if a webhook is delivered late enough, or not at all, that your database and the provider's records disagree — and why isn't idempotent webhook handling alone sufficient?**
A: Idempotency protects against processing the same webhook twice, but does nothing for a webhook that never arrives at all. A reconciliation job is the safety net: periodically compare orders your database still shows as `pending` past a reasonable threshold against the provider's own order-status API, and treat any mismatch as a signal to catch up local state — without this, an order can get silently stuck as `pending` forever.
