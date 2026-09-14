# Orders API v2: Create, Approve, Capture

Phase 1's 3-step checkout shape (create → collect payment method → confirm/capture) applies to PayPal too, but PayPal splits it into three explicitly named, explicitly separate calls rather than the more collapsed flows Stripe and Razorpay use. This lesson walks through PayPal's Orders API v2 version of that shape: create an order server-side, have the buyer approve it client-side via PayPal's Smart Buttons, then capture it server-side to actually move funds.

## 1. Create → Approve → Capture

PayPal's Orders v2 flow names all three of Phase 1's steps explicitly and treats them as genuinely separate API calls rather than folding two of them together:

1. **Create** — your server creates an Order, specifying the amount, currency, and intent (to capture funds). PayPal returns an order ID and a set of HATEOAS-style links, one of which is the approval link the buyer needs to visit or interact with.
2. **Approve** — the buyer approves the order through PayPal's UI (typically PayPal's Smart Buttons rendered on your checkout page, covered in section 2). This is Phase 1's "client collects payment method" step, except here it's phrased as the buyer authorizing PayPal to let the transaction proceed, rather than entering raw card details into a form you built.
3. **Capture** — your server calls a separate capture endpoint on the now-approved order, which is the step that actually moves funds. An order that has been approved but never captured has not collected any money.

```text
Your Server                         PayPal                          Buyer
    |                                  |                               |
    |--- 1. create order ------------->|                               |
    |<-- order id + approval link -----|                               |
    |                                  |<--- buyer approves (Smart ----|
    |                                  |      Buttons / PayPal UI)     |
    |<-- buyer approved (redirect/callback) --------------------------|
    |--- 2. capture order ------------>|                               |
    |<-- funds captured ---------------|                               |
```

This is the same three-step shape Phase 1 taught, just with each step spelled out as its own named PayPal API call, where Stripe's PaymentIntent confirmation (Phase 3) and Razorpay's Checkout-plus-verification (Phase 4) each compress steps together more tightly.

## 2. PayPal Smart Buttons (Client-Side)

PayPal Smart Buttons are a client-side SDK/widget — similar in spirit to Razorpay Checkout's hosted overlay or Stripe's Elements — that renders a "PayPal" (and related) button on your checkout page. When the buyer clicks it, PayPal's own hosted UI takes over the approval step: the buyer logs into PayPal (or pays as a guest, depending on configuration) and approves the specific order your server created in step 1. Your page never collects the buyer's PayPal credentials or raw card data directly — the same PCI-scope benefit Phase 1's Lesson 2 covered generally for hosted UI components.

```js
// ILLUSTRATIVE browser-side snippet — representative of how PayPal's client-side
// SDK/Smart Buttons integration is typically structured, not asserted as exact
// current method/option names. Requires PayPal's client-side SDK script loaded
// on the page and a real order id from a live server-side create call.
// (Not syntax-checked with node --check — this runs in a browser, not Node.)

// paypal.Buttons({
//   createOrder: function (data, actions) {
//     // Calls YOUR server, which performs the server-side "create" call (section 3)
//     // and returns the resulting order id to the browser.
//     return fetch("/api/paypal/create-order", { method: "POST" })
//       .then((res) => res.json())
//       .then((order) => order.id);
//   },
//   onApprove: function (data, actions) {
//     // data.orderID is the order the buyer just approved.
//     // Calls YOUR server, which performs the server-side "capture" call (section 3).
//     return fetch(`/api/paypal/capture-order/${data.orderID}`, { method: "POST" })
//       .then((res) => res.json())
//       .then((captureResult) => {
//         // Show a success screen — but remember Phase 1/2's lesson: this client-side
//         // signal is not the authoritative source; webhook verification (Lesson 3)
//         // is.
//       });
//   },
// }).render("#paypal-button-container");
```

Note the shape: `createOrder` and `onApprove` are both client-side hooks that call back into *your own server*, which is the only party allowed to actually talk to PayPal's Orders API with real credentials — the browser never calls PayPal's create/capture endpoints directly.

## 3. Why Capture Is a Separate Step (Authorization vs. Capture)

PayPal's Orders v2 API deliberately separates **approval** (the buyer says yes) from **capture** (funds actually move), and further distinguishes an **authorization** (funds reserved/held) from a **capture** (funds actually transferred) as the fulfillment intent your order was created with. An order can sit in an approved-but-not-yet-captured state indefinitely if your server never calls the capture endpoint — nothing about approval alone moves money. This mirrors a distinction that exists across the payments industry generally (a hotel "holding" a deposit on your card before checkout is authorization; the eventual charge is the capture), and PayPal's Orders v2 flow makes that distinction an explicit, separate API call rather than an implicit status transition.

```js
// ILLUSTRATIVE ONLY — representative of the shape of the create-order and
// capture-order calls, not asserted as exact live method/field names. Requires
// a live PayPal client id/secret AND a valid OAuth access token (Lesson 1) to
// actually execute. Syntax-checked with `node --check` only.

async function createOrder(accessToken, amount, currency) {
  // Illustrative: POST to PayPal's Orders v2 "create order" endpoint, carrying
  // the OAuth bearer token from Lesson 1.
  const response = await fetch("https://api-m.sandbox.paypal.com/v2/checkout/orders", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          amount: { currency_code: currency, value: amount },
        },
      ],
    }),
  });
  const order = await response.json();
  // order.id, order.status ("CREATED"), order.links (contains the approval link)
  return order;
}

async function captureOrder(accessToken, orderId) {
  // Illustrative: POST to PayPal's Orders v2 "capture" endpoint for an
  // already-approved order.
  const response = await fetch(
    `https://api-m.sandbox.paypal.com/v2/checkout/orders/${orderId}/capture`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    }
  );
  const captureResult = await response.json();
  // captureResult.status ("COMPLETED" on success) — this is the step that
  // actually moves funds.
  return captureResult;
}

module.exports = { createOrder, captureOrder };
```

The exact request/response field names above are illustrative of the general shape (an `amount`/`currency` create call, an order-ID-scoped capture call) rather than asserted verbatim from current PayPal documentation — confirm exact field names against PayPal's docs before wiring up production code.

## Comparison

| Aspect | PayPal (Orders v2: create/approve/capture) | Stripe (PaymentIntent, Phase 3) | Razorpay (Order + Checkout, Phase 4) |
|---|---|---|---|
| Step 1 object | `Order`, created server-side with amount/currency and `intent` | `PaymentIntent`, created server-side with amount/currency | `Order`, created server-side with amount (in paise) and currency |
| Step 2 (buyer/client action) | Buyer approves via PayPal Smart Buttons / hosted UI — a distinct "approve" action | Card details collected via Elements, then the PaymentIntent is confirmed client-side | Buyer completes Razorpay Checkout's hosted overlay widget |
| Step 3 (funds actually move) | Explicit, separate server-side "capture" API call on the approved order | Confirmation of the PaymentIntent (can auto-capture or require a separate capture call depending on configuration) | Payment capture (often automatic depending on configuration), then verified via signature/webhook |
| How explicit is the 3-way split | Most explicit — create, approve, and capture are three distinctly named calls/states | Less explicit — "confirm" folds approval and (often) capture into one conceptual step | Less explicit — Checkout completion and capture are more tightly coupled in the common flow |
| Risk if the last step is skipped | Order stays approved-but-uncaptured; no funds move, ever, until capture is called | Depends on configuration; an uncaptured PaymentIntent may auto-cancel or require manual capture | Depends on configuration; an unconfirmed/uncaptured payment doesn't collect funds |

## Common Mistakes

- Forgetting to actually call the capture endpoint after the buyer approves the order — the approval step alone never moves money; an approved-but-not-captured PayPal order sits inert indefinitely, which can look like "the customer paid" from the client-side success screen while no funds have actually been transferred.
- Confusing authorization (funds reserved/held) with capture (funds actually transferred) — treating a successful "create" or "approve" response as proof of payment repeats exactly the client-trust mistake Phase 1's Lesson 1 and Phase 2's Lesson 1 both warned about generally.
- Letting the browser call PayPal's create/capture endpoints directly with real credentials instead of routing both calls through your own server — the client-side Smart Buttons hooks (`createOrder`, `onApprove`) should only ever call back into your own backend, never hold or use API credentials themselves.
- Reusing a stale or expired OAuth access token (Lesson 1) for the capture call — since capture typically happens moments after approval, this is less common than for long-lived processes, but any server-side PayPal call still depends on a currently-valid bearer token from Lesson 1's caching logic.

## Hands-On Exercises

1. **Syntax-check the create/capture snippet.** Save the `createOrder`/`captureOrder` code from section 3 as `paypal-order.js` and run `node --check paypal-order.js`. Confirm it reports no syntax errors. (It will not run successfully without a live PayPal client id/secret and a valid OAuth access token — that's expected; this only confirms the JavaScript is well-formed.)
2. **Trace an order through all 3 states (paper exercise).** Write out, in your own words, what `order.status` (or equivalent) would represent at each of: right after creation, right after the buyer approves, and right after a successful capture call.
3. **Spot the gap (paper exercise).** A checkout flow creates an order, the buyer approves it via Smart Buttons, and the frontend immediately shows "Payment successful!" — but the developer forgot to wire up the server-side capture call. Write down: has any money moved at this point? What state is the order left in, and what would eventually need to happen to actually collect the funds?
4. **Map the flow onto Phase 1's shape.** Using Phase 1 Lesson 1's three steps (create → collect method → confirm/capture), write down which PayPal call/state corresponds to each of the three steps.
5. **Compare to Razorpay (paper exercise).** Using the Comparison table above and Phase 4 Lesson 1, write one or two sentences on why PayPal's split feels more explicit than Razorpay's Order + Checkout flow, even though both ultimately implement the same 3-step shape.

## Interview Q&A

**Q: What are the three explicit steps in PayPal's Orders v2 flow?**
A: Create (server creates the order with amount/currency/intent), approve (the buyer approves via PayPal's UI, typically Smart Buttons), and capture (server calls a separate endpoint on the approved order to actually move funds).

**Q: If an order has been approved by the buyer but never captured, has any money moved?**
A: No — approval only means the buyer has authorized the transaction to proceed; no funds are transferred until the server explicitly calls the capture endpoint on that order.

**Q: What's the difference between an authorization and a capture in this context?**
A: An authorization reserves/holds funds without transferring them; a capture is the step that actually transfers the funds. PayPal's Orders v2 flow makes the transition from approved to captured an explicit, separate API call rather than an implicit side effect of approval.

**Q: Should the browser ever call PayPal's create-order or capture-order endpoints directly with real API credentials?**
A: No — the client-side Smart Buttons hooks should call back into your own server, which holds the OAuth access token (Lesson 1) and performs the actual create/capture calls against PayPal; the browser never holds or uses PayPal API credentials directly.

**Q: How does PayPal's create/approve/capture split compare to Stripe's PaymentIntent confirmation or Razorpay's Checkout flow?**
A: All three implement the same underlying 3-step shape from Phase 1, but PayPal names and separates all three steps most explicitly as distinct calls/states, whereas Stripe's confirmation and Razorpay's Checkout-plus-verification each fold two of the conceptual steps more tightly together.
