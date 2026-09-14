# Stripe Webhooks in Practice

Phase 2 built the general theory: providers sign webhook payloads with HMAC, you recompute the signature over the raw body, and you compare in constant time. Stripe implements exactly that pattern, but wraps it in an SDK helper so you don't have to hand-roll the HMAC and comparison logic yourself — you just have to feed it the right inputs.

## 1. Stripe's Webhook Verification Helper

Stripe sends a `Stripe-Signature` header alongside every webhook request, and its Node SDK exposes a helper, `stripe.webhooks.constructEvent(rawBody, signatureHeader, endpointSecret)`, that performs the raw-body HMAC recomputation and constant-time comparison from Phase 2's Lesson 2 internally, then returns a parsed event object if verification succeeds (or throws if it doesn't). This is the same general HMAC pattern from Phase 2 — Stripe hasn't invented a new verification mechanism, it's just packaged the compute-and-compare steps into one call plus Stripe-specific parsing of the header's format.

```js
// Illustrative Express-style handler. Requires a live Stripe secret key and
// webhook signing secret to actually run against real traffic — syntax-
// checked with `node --check` only, not executed against a live account.
const express = require("express");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const app = express();
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

// IMPORTANT: raw body parsing applies ONLY to this route, and must run
// before any global JSON body-parsing middleware would consume/transform it.
app.post(
  "/webhooks/stripe",
  express.raw({ type: "application/json" }),
  (req, res) => {
    let event;
    try {
      event = stripe.webhooks.constructEvent(
        req.body, // raw Buffer, not parsed JSON
        req.headers["stripe-signature"],
        endpointSecret
      );
    } catch (err) {
      console.log("Webhook signature verification failed:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Dedup by event.id here (Phase 2, Lesson 3) before doing any work.
    switch (event.type) {
      case "payment_intent.succeeded":
        console.log("PaymentIntent succeeded:", event.data.object.id);
        break;
      case "payment_intent.payment_failed":
        console.log("PaymentIntent failed:", event.data.object.id);
        break;
      case "charge.refunded":
        console.log("Charge refunded:", event.data.object.id);
        break;
      default:
        console.log("Unhandled event type:", event.type);
    }

    res.json({ received: true });
  }
);

module.exports = app;
```

## 2. Key Stripe Event Types

Stripe's events map onto the general categories Phase 2's Lesson 1 described (succeeded, failed, refunded, disputed), just with Stripe's specific naming convention of `object.action`:

| Stripe Event Type | Category (Phase 2, Lesson 1) | What It Means |
|---|---|---|
| `payment_intent.succeeded` | Payment succeeded | A PaymentIntent completed successfully |
| `payment_intent.payment_failed` | Payment failed | A payment attempt on a PaymentIntent failed |
| `charge.refunded` | Refund issued | A charge was refunded, fully or partially |
| `charge.dispute.created` | Dispute opened | A cardholder disputed a charge with their bank |
| `checkout.session.completed` | Payment succeeded (Checkout-specific) | A Checkout Session finished successfully |

## 3. Testing Webhooks Locally

Stripe's servers cannot reach `localhost` directly — there is no route from the public internet to a port on your own machine — so testing webhooks against a local development server requires some form of tunneling or forwarding tool that exposes a local port to a public URL (or otherwise forwards Stripe's test-mode events to your machine). Without one, "just running the handler locally and clicking Pay" will never trigger the webhook at all, which can look like a bug in the handler when it's really a networking gap.

## Comparison

| Aspect | Phase 2's general HMAC pattern | Stripe's `constructEvent` helper |
|---|---|---|
| Signature header | Generic (varies per provider) | `Stripe-Signature` |
| Who computes the HMAC | You, by hand, with `crypto.createHmac` | Stripe's SDK, internally, same underlying HMAC-SHA256 approach |
| Comparison method | You call `crypto.timingSafeEqual` yourself | Handled inside the SDK helper |
| Raw body requirement | Still required — hash must be over raw bytes | Still required — `constructEvent` needs the untouched raw body |
| Failure behavior | You decide how to reject (return an error) | Helper throws; you catch and respond with an error status |

## Common Mistakes

- Applying a body-parsing middleware globally (e.g. `app.use(express.json())` for the whole app) instead of only for non-webhook routes — this consumes and transforms the raw body before `constructEvent` ever sees it, so verification fails even for genuine Stripe events. This is directly the same raw-body mistake Phase 2's Lesson 2 warned about; Stripe's helper needs the exact raw bytes, not a re-parsed object, for the same reason a hand-rolled HMAC check does.
- Assuming local webhook testing works out of the box without any tunneling/forwarding tool — Stripe's servers cannot reach `localhost`, so some mechanism to forward events to your machine is required during local development.
- Not handling `constructEvent` throwing as a signal to reject the request — the helper is designed to throw on a bad signature; treating that thrown error as something to log-and-continue-anyway instead of returning an error response defeats the point of verifying at all.
- Forgetting the dedup-by-event-ID step from Phase 2's Lesson 3 after verification succeeds — signature verification only proves the event is genuine, not that you haven't already processed it once before.

## Hands-On Exercises

1. **Syntax-check the Express webhook handler.** Save the handler code from section 1 as `stripe-webhook.js` and run `node --check stripe-webhook.js`. Confirm it reports no syntax errors. (It will not run correctly without `express`/`stripe` installed and real credentials configured — that's expected; this only confirms the JavaScript is well-formed.)
2. **Spot the middleware bug (paper exercise).** For each of the three Express configurations below, decide whether Stripe webhook signature verification would still succeed:
   - (a) `app.use(express.json())` applied globally, then `app.post("/webhooks/stripe", (req, res) => { ... })` with no route-specific raw body handling.
   - (b) `express.raw({ type: "application/json" })` applied only to the `/webhooks/stripe` route, with no global body parser affecting that route.
   - (c) `express.raw({ type: "application/json" })` applied globally to every route, including ordinary JSON API routes elsewhere in the app.

   (Answers: (a) breaks verification — the global JSON parser consumes and reserializes the body before `constructEvent` sees it. (b) works correctly — the webhook route gets the untouched raw body. (c) verification on the webhook route would still work, but every other JSON API route in the app would now receive a raw `Buffer` instead of a parsed body, breaking those other routes' own body handling.)
3. **Trace the event-type switch.** Using the `switch (event.type)` block in section 1, write down what log line would be produced for an incoming event with `event.type === "charge.refunded"`.
4. **Tunneling gap (paper exercise).** Explain in one or two sentences why a developer who has a webhook handler running correctly on `localhost:3000`, with no tunneling tool active, would never see it invoked by a real Stripe test-mode event — tie your answer to what "Stripe's servers cannot reach localhost" actually means at the network level.

## Interview Q&A

**Q: What header does Stripe send its webhook signature in, and what does the SDK helper that verifies it do?**
A: The `Stripe-Signature` header; `stripe.webhooks.constructEvent(rawBody, signatureHeader, endpointSecret)` recomputes and compares the signature internally, implementing the same general HMAC pattern from Phase 2 with Stripe-specific header parsing, and returns the parsed event on success or throws on failure.

**Q: Why does applying a global JSON body parser break Stripe webhook verification?**
A: It consumes and reserializes the raw request body before `constructEvent` runs, so the bytes being hashed no longer match what Stripe originally signed — the same raw-body requirement Phase 2's signature-verification lesson described in general terms.

**Q: Name two Stripe event types and the general category each falls into.**
A: `payment_intent.succeeded` is a "payment succeeded" event; `charge.refunded` is a "refund issued" event (categories from Phase 2's Lesson 1).

**Q: Why can't you just develop and test a Stripe webhook handler against `localhost` with no other tooling?**
A: Stripe's servers need a publicly reachable URL to deliver the webhook to, and `localhost` isn't reachable from the public internet, so some tunneling/forwarding tool is needed to route Stripe's test-mode events to your local machine.

**Q: After `constructEvent` succeeds, is the handler done verifying it's safe to process the event?**
A: No — successful verification only proves the event is authentic; the handler still needs to check the event's ID against a dedup store (Phase 2, Lesson 3) before doing any work, in case this is a redelivery of an event already processed.
