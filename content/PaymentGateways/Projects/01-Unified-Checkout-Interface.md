# Project 1 — Unified Checkout Interface

**Phases combined:** Phase 1 (the checkout flow shape), Phase 3 (Stripe), Phase 4 (Razorpay), Phase 5 (PayPal)

## Problem Statement

Phase 1 established that every provider implements checkout as the same three-step shape — create the payment object server-side, collect a payment method client-side, confirm/capture server-side — just wearing different object names (`PaymentIntent`, `Order`, `Order`). Phases 3, 4, and 5 then showed each provider's actual step-1 call: `stripe.paymentIntents.create`, `instance.orders.create` (amount in paise), and a PayPal Order create that first requires an OAuth2 bearer token.

A real checkout codebase that supports more than one provider can't have `if (provider === "stripe") { ... } else if (provider === "razorpay") { ... }` scattered across every call site that creates a payment. It needs a single entry point — `createPayment({ provider, amount, currency })` — that the rest of the application calls without caring which provider is behind it, with the provider-specific mechanics pushed into swappable adapters behind that one function.

## Approach Discussion

The design is a dispatch table: one adapter object per provider, each exposing the same `createPayment({ amount, currency })` method, and a single `createPayment` function that looks up the right adapter by `provider` and delegates to it. This is a small, deliberate scope decision worth stating up front: the interface unifies **step 1 only** (Phase 1's "server creates the payment object"). Steps 2 (client collects the payment method) and 3 (confirm/capture) are provider-specific enough — Razorpay's dual signature check, PayPal's OAuth2 token, Stripe's webhook-vs-redirect confirmation — that folding them into the same one-size-fits-all function would either hide details the caller genuinely needs to know about, or force the interface to grow provider-specific optional parameters, which defeats the point of unifying it in the first place. Where it's worth drawing that line is discussed further in Trade-offs.

Each adapter mirrors the real call shape taught in its phase:

- **Stripe adapter** — mirrors Phase 3 Lesson 1's `stripe.paymentIntents.create`: amount is already in minor units (cents), one call, returns an object with Phase 3's verified `requires_payment_method` starting status.
- **Razorpay adapter** — mirrors Phase 4 Lesson 1's `instance.orders.create`: amount is in paise, returns an `Order` with a `created` status. The dual signature check from Phase 4 Lesson 2 happens later, in the confirm step — not inside `createPayment` itself.
- **PayPal adapter** — mirrors Phase 5: before it can create anything, it needs a bearer access token from the OAuth2 client-credentials grant (Phase 5 Lesson 1). This is the one adapter that has an extra hop the other two don't.

Because the real Stripe/Razorpay/PayPal SDK calls all require live credentials to execute (as Phases 3–5 note explicitly, syntax-checking those snippets with `node --check` rather than running them), the adapters below are self-contained mocks that return the same shape a real call would, so the **dispatch logic itself** — the part actually worth testing — can be run for real with `node` and produce real output.

## Solution

```js
// checkout-dispatch.js
// SELF-CONTAINED — no live credentials, no network calls. Adapters below are mock
// stand-ins for the real Stripe/Razorpay/PayPal SDK calls shown in Phases 3/4/5
// (those require live secret keys and are illustrative-only / node --check-only
// there). What's under test here is the DISPATCH LOGIC: routing a single
// createPayment({ provider, amount, currency }) call to the correct adapter.

const adapters = {
  stripe: {
    // Mirrors Phase 3 Lesson 1's createPaymentIntent shape: amount already in
    // minor units (cents), single call, no separate client-side collection step
    // modeled here (Elements/Checkout Session both hidden behind this one call).
    createPayment({ amount, currency }) {
      if (!Number.isInteger(amount) || amount <= 0) {
        throw new Error("stripe adapter: amount must be a positive integer (minor units)");
      }
      return {
        provider: "stripe",
        id: "pi_mock_" + Math.random().toString(36).slice(2, 10),
        amount,
        currency,
        status: "requires_payment_method", // Phase 3's verified PaymentIntent status
      };
    },
  },
  razorpay: {
    // Mirrors Phase 4 Lesson 1's createOrder shape: amount in paise, an Order id
    // returned. Razorpay's dual signature check (client-side + webhook, Phase 4
    // Lesson 2) happens AFTER this call, in the confirm/capture step — out of
    // scope for createPayment itself, which only covers step 1 of the flow.
    createPayment({ amount, currency }) {
      if (!Number.isInteger(amount) || amount <= 0) {
        throw new Error("razorpay adapter: amount must be a positive integer (minor units, e.g. paise)");
      }
      return {
        provider: "razorpay",
        id: "order_mock_" + Math.random().toString(36).slice(2, 10),
        amount,
        currency,
        status: "created",
      };
    },
  },
  paypal: {
    // Mirrors Phase 5: PayPal needs a bearer access token (OAuth2 client-credentials
    // grant, Phase 5 Lesson 1) BEFORE it can create an Order. That token-fetch hop
    // has no equivalent in the Stripe/Razorpay adapters above — this is the first
    // place the unified interface has to paper over a genuine difference (see
    // Trade-offs section). getAccessToken() below is a mock stand-in for the real
    // cached-token flow; it never makes a network call.
    getAccessToken() {
      return "mock_bearer_token_abc123";
    },
    createPayment({ amount, currency }) {
      if (!Number.isInteger(amount) || amount <= 0) {
        throw new Error("paypal adapter: amount must be a positive integer (minor units)");
      }
      const token = this.getAccessToken(); // extra hop Stripe/Razorpay don't need
      return {
        provider: "paypal",
        id: "order_mock_" + Math.random().toString(36).slice(2, 10),
        amount,
        currency,
        status: "CREATED", // PayPal's Orders v2 API uses upper-case status strings
        authorizedWith: token,
      };
    },
  },
};

// The unified interface every caller uses, regardless of provider. This is the
// piece being tested for real: it must dispatch to exactly the right adapter
// and reject a provider nobody registered an adapter for.
function createPayment({ provider, amount, currency }) {
  const adapter = adapters[provider];
  if (!adapter) {
    throw new Error(`createPayment: no adapter registered for provider "${provider}"`);
  }
  return adapter.createPayment({ amount, currency });
}

console.log("--- Dispatch to stripe ---");
console.log(createPayment({ provider: "stripe", amount: 2000, currency: "usd" }));

console.log("\n--- Dispatch to razorpay ---");
console.log(createPayment({ provider: "razorpay", amount: 200000, currency: "INR" }));

console.log("\n--- Dispatch to paypal ---");
console.log(createPayment({ provider: "paypal", amount: 2000, currency: "USD" }));

console.log("\n--- Dispatch to an unregistered provider (expected to throw) ---");
try {
  createPayment({ provider: "square", amount: 1000, currency: "usd" });
} catch (err) {
  console.log("Caught expected error:", err.message);
}

console.log("\n--- Dispatch with an invalid amount (expected to throw, from the stripe adapter) ---");
try {
  createPayment({ provider: "stripe", amount: -5, currency: "usd" });
} catch (err) {
  console.log("Caught expected error:", err.message);
}
```

Actual output from running this with `node`:

```text
--- Dispatch to stripe ---
{
  provider: 'stripe',
  id: 'pi_mock_4857q6ak',
  amount: 2000,
  currency: 'usd',
  status: 'requires_payment_method'
}

--- Dispatch to razorpay ---
{
  provider: 'razorpay',
  id: 'order_mock_kbtw8nu7',
  amount: 200000,
  currency: 'INR',
  status: 'created'
}

--- Dispatch to paypal ---
{
  provider: 'paypal',
  id: 'order_mock_zgdt0k65',
  amount: 2000,
  currency: 'USD',
  status: 'CREATED',
  authorizedWith: 'mock_bearer_token_abc123'
}

--- Dispatch to an unregistered provider (expected to throw) ---
Caught expected error: createPayment: no adapter registered for provider "square"

--- Dispatch with an invalid amount (expected to throw, from the stripe adapter) ---
Caught expected error: stripe adapter: amount must be a positive integer (minor units)
```

Trace through it: `createPayment` never contains a single `if (provider === "stripe")` — it's a plain object lookup (`adapters[provider]`) followed by delegation. Adding a fourth provider means writing one more adapter with the same `createPayment({ amount, currency })` shape and registering it in `adapters`; it never means touching the dispatch function itself. The two error cases confirm the dispatcher rejects an unregistered provider before ever calling an adapter, and that an adapter's own validation (Phase 1's amount-integer guard rail, reused per-provider) still fires correctly when reached through the unified interface rather than called directly.

## Trade-offs and Considerations

**The interface only unifies step 1, and that's intentional, not an oversight.** Phase 1 modeled the checkout flow as three steps; this project's `createPayment` unifies only the first. Trying to also unify step 2 (collecting the payment method) would mean pretending Stripe Elements, the Razorpay Checkout widget, and PayPal Smart Buttons are interchangeable client-side integrations — they aren't, and a caller genuinely needs to know which one it's rendering. Unifying step 3 (confirm/capture) runs into the same problem in sharper form, discussed next.

**PayPal's OAuth2 requirement (Phase 5) is the first crack in the abstraction.** The Stripe and Razorpay adapters use a static key on every call; PayPal's adapter has to fetch (or reuse a cached) bearer token first. This project papers over that difference by hiding the token fetch inside the adapter, which is the right call for `createPayment` specifically — the caller shouldn't need to know PayPal uses OAuth2 just to create a payment object. But it's a leak waiting to happen the moment token *caching* matters: Phase 5 Lesson 1's `token-cache.js` module has state (a cached token, an expiry timestamp) that has to live somewhere across calls, and "somewhere" is now inside an adapter object that the other two adapters have no equivalent concept of. A production version of this interface would need to decide whether that cache lives per-adapter-instance (simple, but ties the cache's lifetime to however the adapter object itself is constructed and reused) or as an explicit dependency injected into the PayPal adapter (more ceremony, but makes the token lifecycle visible and testable independent of the dispatch logic) — this project's mock `getAccessToken()` sidesteps the question entirely by never expiring, which is fine for demonstrating dispatch but would be a real design decision in production.

**Razorpay's dual signature check (Phase 4) is the second crack, and it's arguably worse.** Stripe and PayPal both rely on a webhook as the sole authoritative confirmation signal. Razorpay's flow additionally has a client-relayed signature check that must happen *before* the webhook, using a different secret (the key secret, not the webhook signing secret) and a different HMAC input (`order_id + "|" + payment_id`) than any webhook verification. If a future version of this interface tried to also unify step 3 as `confirmPayment({ provider, ...})`, it would either have to expose a Razorpay-only parameter that Stripe and PayPal simply ignore (leaky, and confusing to a caller who doesn't work with Razorpay day-to-day), or push the confirm step's signature verification entirely into the Razorpay adapter and accept that `confirmPayment`'s actual behavior — how many checks run, against which secrets — is silently different per provider despite looking like the same function call. Neither option is clean; the honest trade-off is that some amount of "the abstraction lies a little" is unavoidable once providers diverge this much, and the discipline that keeps it from becoming a real problem is documenting *where* it lies (as this section does) rather than pretending it doesn't.

**How much to paper over vs. expose, as a general rule:** unify the parts that are genuinely the same shape across providers (Phase 1's "create the payment object" step, which really is one function call everywhere), and leave the parts that are genuinely different (OAuth2 vs. static keys, dual signature checks vs. single webhook, hosted widget vs. redirect) as adapter-specific concerns the caller opts into deliberately, rather than trying to force a single signature over mechanics that don't actually match. A unified interface that hides a real difference until it breaks in production is worse than an interface that's honest about having three slightly different confirm paths behind three different function names.
