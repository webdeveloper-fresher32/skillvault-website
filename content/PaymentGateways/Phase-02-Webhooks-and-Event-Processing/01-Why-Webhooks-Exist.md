# Why Webhooks Exist

The moment a customer clicks "Pay" and gets redirected back to your success page, it's tempting to treat that redirect as proof the payment worked. It isn't. The redirect only proves the customer's browser arrived at a URL — it says nothing about what actually happened on the payment provider's servers, and a huge class of production bugs comes from conflating the two.

## 1. The Client-Side Confirmation Problem

After checkout, most providers send the browser back to your site with a `?success=true`-style query parameter or a redirect to a "thank you" page. This feels like confirmation, but the browser is not a trustworthy witness: the user could close the tab before the redirect fires, lose network connectivity mid-redirect, have the payment succeed *after* a timeout your frontend already gave up on, or — in the worst case — simply type the success URL into the address bar by hand. None of these require malice; ordinary flaky mobile networks produce this exact ambiguity constantly. Your server has no way to distinguish "the redirect params are honest" from "the redirect never happened, or was forged" unless it hears from somewhere it actually trusts. Phase 1 flagged exactly this gap when it warned against trusting the client-side "success" callback as proof of payment; this is where that gap gets closed.

```text
Customer clicks Pay
        |
        v
Provider charges the card (this happens on the provider's servers)
        |
        v
Provider tries to redirect the browser back to your success page
        |
        +--> Browser closed / tab crashed / network dropped here
        |         (payment succeeded, but your server never finds out
        |          from this path)
        v
Your server sees... nothing, from this path
```

## 2. How Webhooks Close the Gap

A webhook is the provider's *backend* calling *your* backend directly — server to server, with no browser in the middle. Because it doesn't depend on the customer's device staying connected or the tab staying open, it's the one signal your server can treat as authoritative for "did this payment actually happen." The client-side redirect is still useful — it's how you show the customer an immediate "Payment received!" screen — but it should never be the trigger that marks an order as paid, ships a product, or grants access to paid content. That trigger belongs to the webhook.

```text
Provider's backend  ---HTTP POST (event payload)--->  Your backend
                                                        (webhook endpoint)

This path does not depend on:
  - the customer's browser still being open
  - the customer's network still being connected
  - the client-side redirect ever firing
```

## 3. Common Payment Event Types

Providers model a payment's lifecycle as a series of discrete events, each delivered as its own webhook. The exact event names differ per provider, but the categories are the same everywhere:

| Event category | What it means | Typical action your handler takes |
|---|---|---|
| Payment succeeded | Funds were successfully captured/authorized | Mark order as paid, fulfill it, send a receipt |
| Payment failed | The charge attempt was declined or errored | Mark order as failed, prompt customer to retry |
| Refund issued | Some or all of a prior payment was returned | Update order status, adjust internal ledgers |
| Dispute opened | The customer's bank/card issuer initiated a chargeback | Flag the order, gather evidence, notify support/finance |

## Comparison

| Aspect | Client-side redirect/callback | Server-to-server webhook |
|---|---|---|
| Trust level | Low — depends on browser reaching your page; can be skipped, faked, or never arrive | High — sent directly from the provider's backend to yours |
| Timing guarantee | None — may never fire (closed tab, dropped network) even if the payment succeeded | Provider retries delivery until acknowledged (see Phase 2's next lessons on retries) |
| Can tell you | "The browser was redirected to this URL with these query params" | "This specific payment event actually occurred, according to the provider's system of record" |
| Can't tell you | Whether the payment actually succeeded on the backend | Nothing about the browser's state — it's independent of what the customer's device is doing |
| Appropriate use | Immediate UI feedback ("Thanks, processing your order...") | The authoritative trigger for marking an order paid, fulfilling it, or reacting to refunds/disputes |

## Common Mistakes

- Marking an order "paid" solely because the client-side redirect included a success parameter, without waiting for or cross-checking the corresponding webhook — this lets a closed tab or a forged query string produce an order that thinks it's paid when it isn't (or vice versa).
- Having no fallback reconciliation job for webhooks that never arrive — if your endpoint is down during a deploy, or a network partition drops the delivery entirely, you need a periodic job that polls the provider's API for orders stuck in a pending state, rather than assuming every webhook eventually lands.
- Treating the webhook endpoint as optional or "nice to have" and building the order-fulfillment logic entirely off the redirect, then bolting webhooks on later as an afterthought.
- Not distinguishing between different event types and just treating "any webhook hit my endpoint" as "payment succeeded," which mishandles failed payments, refunds, and disputes as if they were successes.

## Hands-On Exercises

1. **Paper exercise: diagram the failure.** Sketch the sequence diagram for a checkout flow that trusts only the client-side redirect. Include a step where the customer's phone loses signal right after the charge succeeds on the provider's side but before the redirect reaches your frontend. Label clearly: what does your server currently believe about this order, and what does reality say? Then add the webhook path to the same diagram and show how it resolves the mismatch.
2. **Set up a local webhook receiver.** Save the script below as `webhook-receiver.js` and run it with `node webhook-receiver.js`. It starts an HTTP server with Node's built-in `http` module, and — within the same script — immediately sends it a POST request carrying a JSON payload, so you can see the full round trip in one run.

   ```js
   const http = require("http");

   const server = http.createServer((req, res) => {
     let body = "";
     req.on("data", (chunk) => {
       body += chunk;
     });
     req.on("end", () => {
       console.log(`[receiver] ${req.method} ${req.url}`);
       console.log("[receiver] Headers:", JSON.stringify(req.headers));
       try {
         const payload = JSON.parse(body);
         console.log("[receiver] Parsed JSON payload:", payload);
       } catch (err) {
         console.log("[receiver] Raw body (not valid JSON):", body);
       }
       res.writeHead(200, { "Content-Type": "application/json" });
       res.end(JSON.stringify({ received: true }));
     });
   });

   server.listen(3000, () => {
     console.log("[receiver] Listening on http://localhost:3000");

     const payload = JSON.stringify({
       event: "payment.succeeded",
       id: "evt_1a2b3c",
       amount: 2000,
       currency: "usd",
     });

     const options = {
       hostname: "localhost",
       port: 3000,
       path: "/webhooks/payments",
       method: "POST",
       headers: {
         "Content-Type": "application/json",
         "Content-Length": Buffer.byteLength(payload),
       },
     };

     const clientReq = http.request(options, (clientRes) => {
       let responseBody = "";
       clientRes.on("data", (chunk) => (responseBody += chunk));
       clientRes.on("end", () => {
         console.log(`[client] Response status: ${clientRes.statusCode}`);
         console.log(`[client] Response body: ${responseBody}`);
         server.close(() => {
           console.log("[receiver] Server closed.");
         });
       });
     });

     clientReq.write(payload);
     clientReq.end();
   });
   ```

   Actual output from running this with `node`:

   ```text
   [receiver] Listening on http://localhost:3000
   [receiver] POST /webhooks/payments
   [receiver] Headers: {"content-type":"application/json","content-length":"78","host":"localhost:3000","connection":"keep-alive"}
   [receiver] Parsed JSON payload: {
     event: 'payment.succeeded',
     id: 'evt_1a2b3c',
     amount: 2000,
     currency: 'usd'
   }
   [client] Response status: 200
   [client] Response body: {"received":true}
   [receiver] Server closed.
   ```

3. **Modify the payload.** Change the `payload` object in the exercise above to use `event: "refund.issued"` and a different `amount`, rerun it, and confirm the logged "Parsed JSON payload" reflects your change.
4. **Break the JSON on purpose.** Change `clientReq.write(payload)` to write a non-JSON string instead (e.g. `clientReq.write("not json")`), rerun, and confirm the receiver logs go down the "Raw body (not valid JSON)" branch instead of "Parsed JSON payload."
5. **Reconciliation job sketch.** Write (as pseudocode, not runnable code) a periodic job that queries your own database for orders still `pending` after 10 minutes, and for each one calls the provider's "retrieve payment" API to check its real status — this is the fallback for webhooks that never arrive.

## Interview Q&A

**Q: Why can't you trust a client-side redirect as proof a payment succeeded?**
A: The redirect only tells you the browser reached a URL — it doesn't run on the provider's servers, so it can fail to fire (closed tab, dropped network) even when the payment succeeded, or be reachable without a real payment behind it. It's not connected to the provider's actual payment state.

**Q: What makes a webhook more trustworthy than a redirect?**
A: It's sent server-to-server, directly from the provider's backend to yours, so it doesn't depend on the customer's browser or network staying alive — it reflects what actually happened in the provider's system of record.

**Q: If your webhook endpoint is down for an hour, is that payment data lost forever?**
A: Not necessarily — many providers retry delivery for a period of time, but you should still have a reconciliation job that polls the provider's API for orders in a pending state, in case a webhook was never delivered.

**Q: Should you use the client-side redirect at all, if it's not authoritative?**
A: Yes — it's still useful for immediate UI feedback (e.g., "processing your payment..."), just not as the trigger for marking an order paid, fulfilling it, or reacting to refunds/disputes. That job belongs to the webhook.

**Q: Name two failure modes that let a client-side "success" redirect fire, or fail to fire, independent of what actually happened to the payment.**
A: (1) The customer's tab closes or network drops right after the charge succeeds but before the redirect completes — the payment succeeded but the redirect never fires. (2) A customer manually navigates to the success URL, or the URL is reachable without ever completing a real charge — the redirect fires with no real payment behind it.
