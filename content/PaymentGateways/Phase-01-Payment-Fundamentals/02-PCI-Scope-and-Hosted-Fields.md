# PCI Scope and Hosted Fields

PCI DSS (Payment Card Industry Data Security Standard) governs anyone who stores, processes, or transmits cardholder data — and the moment your own server sees a raw card number, you inherit the full weight of that standard. Hosted fields exist specifically so most businesses never have to.

## 1. What PCI DSS Scope Means

"Scope" means: which systems of yours are subject to PCI DSS's ~300+ requirements (network segmentation, encryption at rest, quarterly vulnerability scans, annual audits, restricted access logging, and more). If your server's code ever touches a raw Primary Account Number (PAN) — even just to forward it along to a processor — that server, the network it sits on, and everything connected to it falls into scope. This is expensive in engineering time, audit fees, and ongoing compliance overhead, and a single mistake (e.g., logging a raw card number by accident) can trigger a costly incident.

```text
Raw PAN touches your server?
   YES → full PCI scope: your infra, logs, backups, and network all
         must meet PCI DSS requirements (SAQ D-level burden)
   NO  → PCI scope is minimal (SAQ A) because the cardholder data
         never entered a system you control
```

## 2. Hosted Fields vs. Handling Raw Card Data

Hosted fields are iframes or SDK-rendered widgets that the provider serves and controls — your page embeds them, but the card number the customer types is captured and transmitted directly to the provider's servers, bypassing yours entirely. Your JavaScript never has access to the raw digits, only a token or a "success/failure" callback.

| Approach | Where raw PAN travels | Who is in scope |
|---|---|---|
| Custom `<input>` form posted to your own `/charge` endpoint | Browser → your server → processor | Your server (full scope) |
| Stripe Elements / Razorpay Checkout / PayPal Smart Buttons (hosted iframe) | Browser → provider's iframe → provider's servers | Provider only (your scope minimized) |

```html
<!-- Example shape of a hosted field (Stripe Elements-style) -->
<div id="card-element"><!-- provider's iframe renders here --></div>
<script>
  // Your JS never reads the card number; it only receives a token/result.
  cardElement.on("change", (event) => {
    // event has validity/error info, NOT the PAN
  });
</script>
```

## 3. SAQ Levels (Practical Overview)

A Self-Assessment Questionnaire (SAQ) is the paperwork tier a merchant fills out to attest PCI compliance; which SAQ applies depends entirely on how cardholder data flows through your systems. Using hosted fields correctly is what lets most SaaS/e-commerce businesses qualify for the shortest, cheapest questionnaire.

## Comparison

| SAQ Type | Burden Level | When It Applies |
|---|---|---|
| SAQ A | Lowest — a short questionnaire, no on-site scanning of your servers required | You fully outsource card data capture to a hosted field/iframe or redirect; your server never receives, processes, transmits, or even sees raw card data |
| SAQ A-EP | Moderate — includes network scans and more extensive controls | You use a hosted field/iframe (like SAQ A), but your own page's JavaScript directly controls or influences the payment form's page (e.g., a script on your checkout page could tamper with the iframe), even though raw PAN itself doesn't hit your server |
| SAQ D | Highest — the full PCI DSS requirement set, quarterly scans, extensive documentation, often a Qualified Security Assessor audit | Your server directly receives, stores, processes, or transmits raw cardholder data (e.g., a custom card form posting PAN to your backend) |

## Common Mistakes

- Building a custom card `<form>` that posts the raw PAN to your own server "just to have more control over styling" — this is avoidable full PCI scope (SAQ D) when a hosted field would have achieved the same visual result with SAQ A.
- Believing that because you use a hosted field, you're automatically SAQ A regardless of how your checkout page's other JavaScript behaves — mixing custom scripts into the same page as the payment form can bump you to SAQ A-EP.
- Assuming hosted fields alone satisfy Strong Customer Authentication (SCA) / 3-D Secure compliance — that's a related but separate concern, covered in a later phase on security and fraud.
- Logging full request/response bodies in development or error-tracking tools without realizing a raw PAN briefly passed through server memory, accidentally creating scope (or a data leak) even in a "hosted field" setup that was misconfigured.
- Treating "PCI compliant" as a one-time checkbox rather than an ongoing obligation tied to how data actually flows through the current version of your systems.

## Hands-On Exercises

1. **Which SAQ level? (paper exercise)** For each architecture below, write down the SAQ level and one sentence justifying it:
   - (a) A checkout page with a custom HTML `<input type="text">` for card number that your Express server reads from `req.body.cardNumber` and forwards to a processor's API.
   - (b) A checkout page using Stripe Elements' hosted iframe, where the only other JavaScript on the page is a simple cart total calculator that doesn't touch the iframe.
   - (c) A checkout page using a hosted iframe for the card fields, but a custom analytics script on the same page dynamically injects DOM elements around the payment form and could theoretically interfere with it.

   Answers: (a) SAQ D — raw PAN reaches your server directly. (b) SAQ A — card data goes straight from the iframe to the provider, and your other script never interacts with the payment form. (c) SAQ A-EP — no raw PAN touches your server, but a script on your page has the ability to influence the payment form, which is exactly what SAQ A-EP's scope covers.

2. **Read your provider's actual card-field docs.** Open Stripe Elements or Razorpay Checkout's integration guide and find the sentence (usually in a security/compliance section) that states which SAQ level their hosted integration qualifies for.

3. **Audit an imaginary checkout page.** Sketch (on paper or in a `.md` note) a checkout page with three third-party scripts (a chat widget, an analytics pixel, and a hosted payment iframe) and reason about whether any of them could plausibly move you from SAQ A to SAQ A-EP.

4. **Compare cost, not just security.** Write two or three bullet points estimating the operational cost difference (audits, engineering time, scan frequency) between maintaining SAQ A vs. SAQ D for a small startup — this is the real-world reason most teams choose hosted fields even when a custom form seems "not that hard" to build securely.

## Interview Q&A

**Q: What single fact determines whether your server falls into full PCI scope?**
A: Whether your server ever receives, processes, stores, or transmits the raw Primary Account Number (PAN) — if it does, even briefly, you're in full scope.

**Q: How do hosted fields like Stripe Elements reduce PCI scope?**
A: The card input lives in an iframe served and controlled by the provider; the raw card number travels directly from the customer's browser to the provider's servers, so your server and its surrounding infrastructure never touch it, qualifying you for the minimal SAQ A.

**Q: What's the practical difference between SAQ A and SAQ A-EP?**
A: Both keep raw PAN off your server via a hosted field/iframe, but SAQ A-EP applies when your own page's script could still influence or tamper with that payment form; SAQ A requires that your page's other code has no bearing on it.

**Q: Does using a hosted field automatically make you SCA/3DS compliant?**
A: No — SCA/3DS is a separate authentication requirement layered on top of the payment flow; hosted fields help with PCI scope, not with SCA, which is covered in a later security-focused phase.

**Q: Why would a team deliberately choose a custom card form knowing it means SAQ D?**
A: Rarely justified for typical businesses; it's occasionally chosen when a company needs to store/process cards directly for a specialized business reason (e.g., a payment processor itself), but for most merchants the added audit burden isn't worth any UI flexibility gained.
