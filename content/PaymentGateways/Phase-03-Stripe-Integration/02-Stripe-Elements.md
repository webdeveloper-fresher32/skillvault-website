# Stripe Elements

Stripe Elements is the client-side piece that makes the PaymentIntent flow from the previous lesson actually collect a card without your server ever seeing it. It's the same hosted-field pattern Phase 1's Lesson 2 described in general terms, made concrete with Stripe's own SDK and iframe.

## 1. What Elements Actually Does (Hosted iFrame)

Elements renders a card input (or a broader "Payment Element" covering multiple payment methods) inside an iframe that Stripe itself serves and controls, embedded into your page. Your JavaScript mounts the Element into a `<div>` you designate, but everything the customer types into that field lives inside Stripe's iframe — your code can react to events like validation state or "the field is now complete," but it never has access to the raw card number, exactly as Phase 1's Lesson 2 described for hosted fields in general. This is what lets a Stripe Elements integration typically qualify for the lightest PCI questionnaire tier (SAQ A) discussed in that lesson, as long as no other script on the same page interferes with the payment form.

```html
<!-- Illustrative browser-side markup, not something Node executes -->
<form id="payment-form">
  <div id="card-element"><!-- Stripe's iframe mounts here --></div>
  <button id="submit">Pay</button>
</form>
```

## 2. The Client-Side Confirmation Call

Once the customer has filled in the Element and clicked "Pay," your client-side JavaScript calls a Stripe.js confirmation method (in the browser, using the `client_secret` your server generated when it created the PaymentIntent), passing it a reference to the mounted Element. Stripe.js takes the payment details straight from its own iframe and sends them directly to Stripe's servers to attempt confirmation — the tokenized details never pass through your backend at all. This is the "collect payment method" step (step 2) from Phase 1's checkout flow shape, concretely: it's client-initiated, but the actual card data still only ever travels between the customer's browser and Stripe.

```js
// Illustrative browser-side JavaScript. This runs in a browser page, not in
// Node — it is not something `node` can meaningfully execute, since it
// depends on the Stripe.js browser SDK and a live DOM. Syntax is standard
// JS, shown here to illustrate the shape of the call, not to be run directly.
async function handleSubmit(stripe, elements, clientSecret) {
  const { error, paymentIntent } = await stripe.confirmPayment({
    elements,
    clientSecret,
    confirmParams: {
      return_url: "https://example.com/checkout/return",
    },
    redirect: "if_required",
  });

  if (error) {
    console.log("Confirmation failed:", error.message);
    return;
  }

  console.log("PaymentIntent status after confirmation:", paymentIntent.status);
}
```

## 3. Handling Extra Authentication Redirects (Preview of a Later Security Phase)

Some payments require an extra authentication step beyond just the card details — for example, a card issuer requiring the customer to approve the charge in their banking app before it can complete. When this happens, the PaymentIntent's status moves to a value indicating additional action is required, and Stripe.js can redirect the customer through that authentication step before returning control to your page. Your client-side code has to handle this outcome rather than assuming every confirmation call resolves straight to `succeeded`. The mechanics of exactly why this extra step exists (card-network authentication rules, fraud-liability shifts) belong to a later phase on payment security — for now, the important part is simply that your handler must branch on status rather than assuming success.

## Comparison

| Approach | Where raw card data goes | Your JS can read the card number? | Extra-authentication handling |
|---|---|---|---|
| Custom `<input>` posted to your own server | Browser → your server | Yes (and that's the problem — full PCI scope) | You'd have to build this yourself entirely |
| Stripe Elements + confirmation call | Browser → Stripe's iframe → Stripe's servers directly | No — by design, only validity/completeness events are exposed | Built into the confirmation method's return value/redirect flow |

## Common Mistakes

- Trying to read the card number out of an Element — this is impossible by design, not a missing feature. The entire point of the hosted-iframe pattern from Phase 1's Lesson 2 is that your page's JavaScript never has access to the raw digits; if you find yourself looking for a way to extract them, that's a sign the integration approach is wrong for the goal.
- Not handling the status returned when additional authentication is needed — code that assumes the confirmation call always ends in `succeeded` or a hard failure will break silently (or worse, appear to hang) for the subset of payments that require the extra authentication step.
- Assuming Elements alone satisfies every compliance requirement around card acceptance — as Phase 1's Lesson 2 noted, hosted fields address PCI scope specifically, not authentication requirements, which are a related but separate concern.
- Letting unrelated custom scripts on the same checkout page manipulate the DOM around the mounted Element — this is the same SAQ A vs. SAQ A-EP distinction from Phase 1's Lesson 2, and it applies to Stripe Elements exactly as described there.

## Hands-On Exercises

1. **Trace a status through extra authentication (paper exercise).** Starting from `requires_payment_method`, write out the sequence of PaymentIntent statuses you'd expect for a payment that requires extra authentication before it succeeds, noting where in that sequence the customer would be redirected away from (and back to) your page.
2. **Identify the impossible read.** Explain in your own words why `cardElement.getCardNumber()` (a made-up, intentionally nonexistent method) could never be a real Stripe Elements API, tying your answer back to what PCI scope reduction requires.
3. **Compare to the custom-form path.** Using Phase 1 Lesson 2's SAQ table, write down which SAQ level applies to (a) a Stripe Elements integration with no other DOM-manipulating scripts on the page, and (b) a custom `<input>` form posting card data to your own server.
4. **Reason about a broken assumption.** A developer writes client-side code that does `if (paymentIntent.status === "succeeded") { showSuccess(); } else { showError(); }` right after calling the confirmation method. Explain what happens to a customer whose payment actually needs extra authentication, given this code.

## Interview Q&A

**Q: Why can't your JavaScript read the raw card number out of a mounted Stripe Element?**
A: By design — the input lives inside an iframe that Stripe serves and controls, so your page's script never has access to it; this is the mechanism that keeps raw card data off your systems and out of PCI scope.

**Q: What does the client-side confirmation call actually send to Stripe, and from where?**
A: The payment details captured inside Stripe's own iframe, sent directly from the customer's browser to Stripe's servers — the tokenized details never pass through your backend.

**Q: What must client-side code do differently when a payment requires extra authentication?**
A: It must branch on the status/outcome the confirmation call returns rather than assuming every attempt ends in immediate success or failure, since some payments require an additional authentication step before resolving.

**Q: Does using Stripe Elements automatically satisfy every card-acceptance compliance requirement?**
A: No — it addresses PCI scope specifically; authentication requirements are a separate concern covered in a later security-focused phase.
