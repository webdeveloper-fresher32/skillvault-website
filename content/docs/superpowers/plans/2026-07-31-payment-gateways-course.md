# Payment Gateways Course Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete `PaymentGateways/` course in SkillVault — 10 phases (provider-agnostic fundamentals → Stripe/Razorpay/PayPal integrations → cross-cutting concerns → provider comparison and production practices), each with a phase README and numbered topic-headed lessons; a `Projects/` folder of 3 end-to-end builds; a `Quick-Reference/` folder (cheatsheet + 50 interview Q&A); and a course-level README — matching the structural conventions of Docker/Kubernetes/Networking/AWS and the reformatted GithubActions course.

**Architecture:** Pure-content repo (no build system, no tests, per `CLAUDE.md`). Every lesson uses the topic-headed template from the start (no narrative-template-then-reformat detour this time). Code examples are Node.js. "Verification" means: every JSON/code snippet is well-formed (JSON validated via `JSON.parse`, JS syntax-checked via `node --check` or actually executed where the logic is self-contained, e.g. signature-verification/HMAC logic); every fact/citation is accurate; every Hands-On Exercise is logically self-consistent (sanity-check multi-step sequences by tracing them — this reformat-adjacent course has a documented track record of exercise-sequencing bugs slipping through in the GithubActions build, so this is not optional). Each task produces one phase (or top-level folder) fully populated and committed independently.

**Tech Stack:** GitHub-flavored Markdown, JavaScript/Node.js (API calls, webhook handlers, signature verification), JSON (API payloads/webhook event examples).

**Lesson format (applies to every lesson file in Phases 1–10):**
```markdown
# <Topic>

(1 short paragraph, 2-4 sentences — what this is and why it matters)

## 1. <Topic-named section>
(short prose, 2-5 sentences) → immediately followed by a code snippet, diagram, or table

## 2-N. <as many topic-named sections as the concept needs>

## Comparison
(STANDALONE heading, ALWAYS present, table format, every cell filled — compares 2+ things: providers, approaches, or concepts from this lesson)

## Common Mistakes
(3-5 concrete bullets)

## Hands-On Exercises
(3-5 runnable exercises — real Node.js snippets against sandbox/test-mode credentials, or concrete "build this and observe X" steps; each exercise's setup/outcome must be logically self-consistent — trace multi-step sequences before finalizing)

## Interview Q&A
(3-5 short, direct Q&A pairs — no narration)
```

Every lesson file must contain: no "Problem"/"Analogy"/"Internal Flow"/"Memory Hook"/"Interview Angle" headings (those belong to the OLD template this course is explicitly avoiding); a standalone `## Comparison` heading with every table cell filled; genuinely interleaved code (not concentrated in one section); direct Interview Q&A (not narrated). Every JSON example must parse via `JSON.parse`. Every JS snippet with self-contained logic (no external network calls required, e.g. HMAC signature verification, currency minor-unit conversion) must actually be extracted and run with `node`, with real captured output — not fabricated. Snippets that inherently require live API credentials (e.g. an actual `stripe.paymentIntents.create()` call) should be marked as illustrative and syntax-checked with `node --check` rather than executed, since this course has no live sandbox credentials — state this limitation honestly in the lesson rather than fabricating API response output.

**Phase README format (matches `Docker/Phase-01-Fundamentals/README.md` and `GithubActions/Phase-01.../README.md`):**
```markdown
# Phase N: <Phase Title>

## What You'll Learn
(1-2 sentences)

## Learning Objectives
- ...

## Topics

| File | Topic | Time |
|------|-------|------|
| [01-Xxx.md](01-Xxx.md) | ... | ... |

## Estimated Time
(N days)

## Next Phase
→ [Phase N+1: <Title>](../Phase-NN-<Title>/README.md)
```
(Phase 10's "Next Phase" line instead reads `→ [Projects](../Projects/README.md)`.)

---

### Task 1: Phase 01 — Payment Fundamentals

**Files:**
- Create: `PaymentGateways/Phase-01-Payment-Fundamentals/README.md`
- Create: `PaymentGateways/Phase-01-Payment-Fundamentals/01-The-Checkout-Flow-Shape.md`
- Create: `PaymentGateways/Phase-01-Payment-Fundamentals/02-PCI-Scope-and-Hosted-Fields.md`
- Create: `PaymentGateways/Phase-01-Payment-Fundamentals/03-Test-Mode-and-Idempotency-Keys.md`

Content requirements per file (topic-headed template, code interleaved, standalone Comparison, Common Mistakes, Hands-On Exercises, Interview Q&A):

- `01-The-Checkout-Flow-Shape.md`: the three-step shape shared by every major provider — (1) server creates a payment/order object with amount+currency, (2) client collects the payment method via a hosted widget/redirect, (3) server confirms/captures and the client polls or waits for a webhook. Topic sections: "Why the Flow Is Server-Initiated," "The Three-Step Shape," "Where Providers Diverge (Preview)." Comparison table: Stripe/Razorpay/PayPal's names for the same three steps (Payment Intent vs. Order vs. Order — same shape, different vocabulary), to be filled in accurately per each provider's actual terminology. Common mistakes: creating the payment object client-side (lets a user tamper with the amount); trusting the client-side "success" callback as authoritative instead of waiting for server-side confirmation via webhook (this sets up Phase 2). Hands-On Exercises: write a Node.js function that models the 3-step flow with mock objects (no live API), tracing state transitions; a "spot the bug" exercise showing a client-tampered-amount vulnerability.
- `02-PCI-Scope-and-Hosted-Fields.md`: what PCI DSS scope means in practice (if your server ever sees a raw card number, you're in full PCI scope — expensive/burdensome), how hosted fields/iframes (Stripe Elements, Razorpay Checkout, PayPal Smart Buttons) keep raw card data away from your server entirely, reducing scope to SAQ A. Topic sections: "What PCI DSS Scope Means," "Hosted Fields vs. Handling Raw Card Data," "SAQ Levels (Practical Overview)." Comparison table: SAQ A vs SAQ A-EP vs SAQ D — burden level and when each applies. Common mistakes: building a custom card form that posts raw PAN to your own server (full PCI scope, avoidable); assuming hosted fields alone are suffient for SCA/3DS compliance (a separate concern, forward-referenced to Phase 8). Hands-On Exercises: a "which SAQ level" quiz-style exercise (paper exercise) walking through 3 different integration architectures and identifying scope for each.
- `03-Test-Mode-and-Idempotency-Keys.md`: every provider's test/sandbox mode conventions (separate test API keys, test card numbers that simulate success/decline), idempotency keys as a client-generated unique value sent with a request so a retried request (e.g. after a network timeout) doesn't create a duplicate charge. Topic sections: "Test Mode and Test API Keys," "Idempotency Keys," "What Happens Without One (the Duplicate-Charge Bug)." Example: a Node.js snippet generating a UUID idempotency key and including it in a mock request object — actually run with `node` to show the UUID generation working, and a second snippet simulating a retried request reusing the same key to demonstrate deduplication conceptually (commented, since it needs a live API to truly demonstrate). Common mistakes: generating a NEW idempotency key on every retry attempt (defeats the purpose — must reuse the same key across retries of the SAME logical request); using test-mode API keys in a mixed-mode environment without realizing test-mode webhooks won't fire to a production-mode webhook endpoint. Hands-On Exercises: write and run a Node.js function generating idempotency keys, verify with `node` that calling it once and reusing the key vs. generating a new one each time produces the expected key values.

- [ ] **Step 1: Write the 3 lesson files** per the content requirements above, following the topic-headed template exactly.
- [ ] **Step 2: Write the phase README.md** — Title "Phase 1: Payment Fundamentals." Objectives: understand the shared checkout-flow shape; understand PCI scope reduction via hosted fields; use idempotency keys correctly. Topics table, 1 day each. Estimated Time: 3 days. Next Phase → `../Phase-02-Webhooks-and-Event-Processing/README.md`.
- [ ] **Step 3: Verify** — every JSON example parses via `JSON.parse` (extract and check with `node -e "JSON.parse(require('fs').readFileSync('/tmp/x.json'))"` or equivalent); every self-contained JS snippet (idempotency key generation) actually run with `node` and output captured, not fabricated; every lesson has a standalone `## Comparison` with every cell filled; run `grep -c '^## ' PaymentGateways/Phase-01-Payment-Fundamentals/0*.md` and confirm each lesson has Comparison + Common Mistakes + Hands-On Exercises + Interview Q&A as 4 of its headings (plus however many numbered topic sections).
- [ ] **Step 4: Commit**
  ```bash
  git add PaymentGateways/Phase-01-Payment-Fundamentals
  git commit -m "Add Payment Gateways Phase 1: Payment Fundamentals"
  ```

---

### Task 2: Phase 02 — Webhooks and Event Processing

**Files:**
- Create: `PaymentGateways/Phase-02-Webhooks-and-Event-Processing/README.md`
- Create: `PaymentGateways/Phase-02-Webhooks-and-Event-Processing/01-Why-Webhooks-Exist.md`
- Create: `PaymentGateways/Phase-02-Webhooks-and-Event-Processing/02-Signature-Verification.md`
- Create: `PaymentGateways/Phase-02-Webhooks-and-Event-Processing/03-At-Least-Once-Delivery-and-Idempotent-Handlers.md`

Content requirements:

- `01-Why-Webhooks-Exist.md`: the client-side "success" redirect/callback is not authoritative (the user could close the tab, lose network, or the browser could lie) — only a server-to-server webhook, sent directly from the provider's backend, can be trusted as the source of truth for "the payment actually succeeded." Topic sections: "The Client-Side Confirmation Problem," "How Webhooks Close the Gap," "Common Payment Event Types (payment succeeded/failed, refund issued, dispute opened)." Comparison table: client-side callback vs. server-side webhook — trust level, timing guarantees, what each can/can't tell you. Common mistakes: marking an order "paid" based solely on the client-side redirect; not having a fallback reconciliation job for webhooks that never arrive (network partition, endpoint downtime). Hands-On Exercises: paper exercise diagramming what could go wrong if an app trusts only the client callback; set up a local webhook receiver with Node's built-in `http` module that logs incoming JSON payloads (runnable, self-contained).
- `02-Signature-Verification.md`: every provider signs its webhook payloads (HMAC-based) so you can verify the request genuinely came from the provider and wasn't forged/tampered with, the general pattern (compute HMAC-SHA256 of the raw request body using a shared webhook secret, compare to the signature header, using constant-time comparison to avoid timing attacks). Topic sections: "Why Verify Signatures," "The General HMAC Verification Pattern," "Constant-Time Comparison (Avoiding Timing Attacks)." Example: a real, runnable Node.js function using `crypto.createHmac('sha256', secret).update(rawBody).digest('hex')` and `crypto.timingSafeEqual` for the comparison — actually run with `node` against a sample payload and secret, confirming the computed signature matches a hand-verified expected value. Common mistakes: computing the HMAC over the PARSED/re-serialized JSON body instead of the exact RAW bytes received (JSON re-serialization can change key order/whitespace, breaking the signature — must verify against the raw, unparsed request body before any JSON parsing happens); using plain `===` string comparison instead of a constant-time comparison function, creating a timing side-channel. Hands-On Exercises: run the HMAC verification function against a tampered payload and confirm it correctly rejects it; run it against the original payload and confirm it accepts it.
- `03-At-Least-Once-Delivery-and-Idempotent-Handlers.md`: providers guarantee "at-least-once" webhook delivery (a webhook might be sent more than once for the same event, e.g. if your endpoint is slow to acknowledge), so handlers must be idempotent — processing the same event twice must not double-credit an order or send two confirmation emails. Topic sections: "At-Least-Once Delivery," "Making Handlers Idempotent (Dedup by Event ID)," "Returning 2xx Quickly (and Processing Async)." Example: a Node.js handler snippet using an in-memory `Set` of processed event IDs to demonstrate deduplication logic — actually run with `node`, feeding it the same event ID twice and confirming the second call is skipped. Common mistakes: not deduplicating by the event's unique ID, causing a re-delivered webhook to double-process (e.g., grant a subscription twice); doing slow synchronous work (e.g., sending an email, calling a third-party API) inside the webhook handler before returning a 2xx response, causing the provider to time out and retry, creating a delivery storm. Hands-On Exercises: run the dedup-by-event-ID snippet feeding it 3 events where one ID repeats, confirm only 2 are processed; a paper exercise identifying which of 3 sample handler implementations would incorrectly double-process a retried webhook.

- [ ] **Step 1: Write the 3 lesson files.**
- [ ] **Step 2: Write the phase README.md** — Title "Phase 2: Webhooks and Event Processing." Objectives: explain why webhooks are authoritative and client callbacks aren't; implement HMAC signature verification correctly; write idempotent webhook handlers. Topics table, 1 day each. Estimated Time: 3 days. Next Phase → `../Phase-03-Stripe-Integration/README.md`.
- [ ] **Step 3: Verify** — actually run the HMAC signature verification snippet and the dedup-by-event-ID snippet with `node`, confirming real output (not fabricated); every JSON payload example parses; standalone Comparison sections present with every cell filled.
- [ ] **Step 4: Commit**
  ```bash
  git add PaymentGateways/Phase-02-Webhooks-and-Event-Processing
  git commit -m "Add Payment Gateways Phase 2: Webhooks and Event Processing"
  ```

---

### Task 3: Phase 03 — Stripe Integration

**Files:**
- Create: `PaymentGateways/Phase-03-Stripe-Integration/README.md`
- Create: `PaymentGateways/Phase-03-Stripe-Integration/01-Payment-Intents-and-Checkout-Sessions.md`
- Create: `PaymentGateways/Phase-03-Stripe-Integration/02-Stripe-Elements.md`
- Create: `PaymentGateways/Phase-03-Stripe-Integration/03-Stripe-Webhooks-in-Practice.md`

Content requirements (this phase should reference back to Phases 1-2 rather than re-teaching the general shape/signature-verification pattern):

- `01-Payment-Intents-and-Checkout-Sessions.md`: Stripe's PaymentIntent object (represents Phase 1's "payment object," tracks status through its lifecycle: `requires_payment_method` → `requires_confirmation` → `processing` → `succeeded`), Checkout Sessions as Stripe's hosted, pre-built checkout page (the simplest integration path, maximal PCI-scope reduction per Phase 1's Lesson 2). Topic sections: "Creating a PaymentIntent," "Checkout Sessions (Hosted Checkout)," "Choosing Between Them." Example: a `stripe-node` snippet creating a PaymentIntent with amount/currency (illustrative — syntax-checked with `node --check`, marked as requiring a live Stripe test-mode secret key to actually execute). Comparison table: PaymentIntents+Elements (more control, more integration work) vs. Checkout Sessions (less control, fastest to ship). Common mistakes: passing a dollar amount instead of the minor-unit integer Stripe expects (e.g. `2000` for $20.00, not `20` — forward-references Phase 9's currency minor-unit lesson); forgetting to set `automatic_payment_methods` or a specific `payment_method_types`, causing unexpected payment method availability. Hands-On Exercises: syntax-check (via `node --check`) a Checkout Session creation snippet; a paper exercise mapping Phase 1's 3-step flow onto Stripe's specific object names.
- `02-Stripe-Elements.md`: Stripe Elements as the hosted-iframe card input widget (the client-side half of the PCI-scope reduction from Phase 1), the general integration pattern (mount an Element, collect payment details client-side, call `stripe.confirmPayment()` which sends the tokenized details directly to Stripe — never touching your server). Topic sections: "What Elements Actually Does (Hosted iFrame)," "The Client-Side Confirmation Call," "Handling 3D Secure Redirects (Preview of Phase 8)." Example: a client-side JS snippet (illustrative, browser-only, syntax-checked with `node --check` where applicable — noting it's browser DOM code so full Node execution isn't meaningful, and stating that honestly) showing `stripe.confirmPayment()`. Common mistakes: trying to read the card number out of an Element (impossible by design — this is the whole point of PCI scope reduction, and attempting workarounds defeats it); not handling the `requires_action` status returned when 3D Secure authentication is needed. Hands-On Exercises: a paper exercise tracing what happens to a PaymentIntent's status through a 3D-Secure-required flow.
- `03-Stripe-Webhooks-in-Practice.md`: Stripe's specific webhook signature scheme (`Stripe-Signature` header, `stripe.webhooks.constructEvent()` helper which implements Phase 2's general HMAC pattern), Stripe's specific event names (`payment_intent.succeeded`, `charge.refunded`, etc.). Topic sections: "The `Stripe-Signature` Header and `constructEvent()`," "Key Stripe Event Types," "Testing Webhooks Locally with the Stripe CLI." Example: a Node.js Express-style handler snippet using `stripe.webhooks.constructEvent(rawBody, sig, webhookSecret)` — syntax-checked with `node --check`, explicitly noting this wraps Phase 2's general HMAC pattern with Stripe-specific parsing. Common mistakes: using a body-parsing middleware (like `express.json()`) globally, which consumes/transforms the raw body before `constructEvent()` can verify it against the raw bytes (must use the raw body specifically for the webhook route — directly connects to Phase 2's raw-body mistake); forgetting Stripe CLI's `stripe listen --forward-to` is needed for local webhook testing since Stripe can't reach `localhost` directly. Hands-On Exercises: syntax-check the Express webhook handler snippet; a paper exercise listing which of 3 sample Express middleware configurations would break signature verification.

- [ ] **Step 1: Write the 3 lesson files**, explicitly citing back to Phase 1 (checkout flow shape, PCI scope) and Phase 2 (webhook signature verification pattern, idempotent handlers) wherever the general concept was already taught there.
- [ ] **Step 2: Write the phase README.md** — Title "Phase 3: Stripe Integration." Objectives: create PaymentIntents/Checkout Sessions; integrate Stripe Elements; verify and handle Stripe webhooks correctly. Topics table, 1 day each. Estimated Time: 3 days. Next Phase → `../Phase-04-Razorpay-Integration/README.md`.
- [ ] **Step 3: Verify** — syntax-check all Node.js snippets with `node --check`; every JSON example parses; standalone Comparison sections present; confirm each file's cross-references to Phase 1/2 are accurate (re-read those phases if needed).
- [ ] **Step 4: Commit**
  ```bash
  git add PaymentGateways/Phase-03-Stripe-Integration
  git commit -m "Add Payment Gateways Phase 3: Stripe Integration"
  ```

---

### Task 4: Phase 04 — Razorpay Integration

**Files:**
- Create: `PaymentGateways/Phase-04-Razorpay-Integration/README.md`
- Create: `PaymentGateways/Phase-04-Razorpay-Integration/01-Orders-API-and-Razorpay-Checkout.md`
- Create: `PaymentGateways/Phase-04-Razorpay-Integration/02-Client-and-Server-Signature-Verification.md`
- Create: `PaymentGateways/Phase-04-Razorpay-Integration/03-Razorpay-Webhooks-in-Practice.md`

Content requirements:

- `01-Orders-API-and-Razorpay-Checkout.md`: Razorpay's Order object (created server-side with amount in paise — India's minor currency unit — and currency, Phase 1's "payment object"), Razorpay Checkout as the client-side hosted widget invoked with the order ID. Topic sections: "Creating an Order," "Razorpay Checkout (Client-Side)," "Mapping to Phase 1's 3-Step Flow." Example: a `razorpay` Node SDK snippet creating an order — syntax-checked with `node --check`, marked illustrative (needs live test-mode key/secret). Comparison table: Razorpay Order+Checkout vs. Stripe's PaymentIntent+Elements vs. Checkout Session — same shape, different names, noting Razorpay Checkout always redirects/overlays rather than offering Stripe-Elements-style embedded fields as the default path. Common mistakes: passing the amount in rupees instead of paise (the minor-unit gotcha, same class of bug as Stripe's cents, forward-references Phase 9); forgetting `currency: "INR"` defaults may not apply for all Razorpay account configurations. Hands-On Exercises: syntax-check the order-creation snippet; a paper exercise converting a set of rupee amounts to paise correctly.
- `02-Client-and-Server-Signature-Verification.md`: Razorpay's DISTINCTIVE two-signature-check model — after checkout, the CLIENT receives `razorpay_payment_id`, `razorpay_order_id`, and `razorpay_signature`, which must be sent to YOUR server and verified there (an HMAC of `order_id + "|" + payment_id` using the key secret) BEFORE trusting the payment client-side, in ADDITION TO the separate webhook signature verification from Phase 2's general pattern — this dual-verification requirement is a Razorpay-specific nuance not present in Stripe or PayPal's simpler single-webhook-trust model. Topic sections: "The Client-Side Verification Step (Razorpair-Specific)," "Why This Exists (Extra Defense Against a Compromised Client)," "This Is IN ADDITION TO Webhook Verification, Not Instead Of." Example: a real, runnable Node.js function computing `crypto.createHmac('sha256', secret).update(order_id + '|' + payment_id).digest('hex')` and comparing to the received signature — actually run with `node` against a sample order_id/payment_id/secret, confirming the computed value against a hand-verified expected signature. Common mistakes: treating the client-side signature check as sufficient on its own and skipping webhook verification entirely (the client-side check proves the CLIENT saw a valid-looking success, but only the webhook is the true server-to-server confirmation — this exact distinction is what Phase 2 Lesson 1 taught in the abstract); mixing up the concatenation order (`order_id + "|" + payment_id`, not the reverse) which silently produces a wrong signature that always fails. Hands-On Exercises: run the signature-verification function with the correct concatenation order and confirm it matches; run it with the order swapped and confirm it does NOT match (demonstrating the ordering mistake concretely).
- `03-Razorpay-Webhooks-in-Practice.md`: Razorpay's webhook signature scheme (`X-Razorpay-Signature` header, HMAC-SHA256 of the raw body using a separately-configured webhook secret — distinct from the API key secret used in Lesson 2's client-side check), key event types (`payment.captured`, `payment.failed`, `refund.processed`). Topic sections: "The `X-Razorpay-Signature` Header," "Webhook Secret vs. API Key Secret (Don't Confuse Them)," "Key Razorpay Event Types." Example: a Node.js handler snippet verifying the webhook signature using Phase 2's general HMAC pattern with Razorpay's specific header name — syntax-checked with `node --check`. Common mistakes: using the API key secret (from Lesson 2) to verify webhook signatures instead of the separately-generated webhook secret (they are DIFFERENT secrets configured in different places in the Razorpay dashboard); not handling `payment.failed` events, silently leaving failed-payment orders in a pending state forever. Hands-On Exercises: syntax-check the webhook handler; a paper exercise identifying which of two secrets (API key secret vs. webhook secret) should be used for a given verification scenario, reinforcing the distinction.

- [ ] **Step 1: Write the 3 lesson files**, explicitly citing Phase 1/2, and give Lesson 2's client-side signature verification the most careful, precise treatment in the whole phase since it's the one genuinely Razorpay-specific security nuance.
- [ ] **Step 2: Write the phase README.md** — Title "Phase 4: Razorpay Integration." Objectives: create Orders and integrate Razorpay Checkout; correctly implement BOTH client-side and webhook signature verification; avoid confusing the two different secrets involved. Topics table, 1 day each. Estimated Time: 3 days. Next Phase → `../Phase-05-PayPal-Integration/README.md`.
- [ ] **Step 3: Verify** — actually run BOTH the client-side signature verification function (Lesson 2) and confirm the correct-vs-swapped-order test cases produce the expected match/no-match results; syntax-check all other snippets; standalone Comparison sections present.
- [ ] **Step 4: Commit**
  ```bash
  git add PaymentGateways/Phase-04-Razorpay-Integration
  git commit -m "Add Payment Gateways Phase 4: Razorpay Integration"
  ```

---

### Task 5: Phase 05 — PayPal Integration

**Files:**
- Create: `PaymentGateways/Phase-05-PayPal-Integration/README.md`
- Create: `PaymentGateways/Phase-05-PayPal-Integration/01-OAuth2-Client-Credentials-Flow.md`
- Create: `PaymentGateways/Phase-05-PayPal-Integration/02-Orders-API-v2-Create-Approve-Capture.md`
- Create: `PaymentGateways/Phase-05-PayPal-Integration/03-PayPal-Webhooks-in-Practice.md`

Content requirements:

- `01-OAuth2-Client-Credentials-Flow.md`: PayPal's DISTINCTIVE requirement (vs. Stripe/Razorpay's simple static-API-key-in-header model) that server-side API calls need a short-lived OAuth2 access token obtained via the client-credentials grant (POST to `/v1/oauth2/token` with client ID + secret as Basic Auth, receiving a bearer token that expires, typically in ~9 hours) before any Orders API call can be made. Topic sections: "Why PayPal Uses OAuth2 (vs. Stripe/Razorpay's Static Keys)," "The Client-Credentials Grant," "Token Caching and Expiry Handling." Example: a real, runnable Node.js function structure for caching a token in memory with an expiry timestamp check (illustrative token-fetch call syntax-checked with `node --check` since it needs live credentials, but the CACHING LOGIC itself — checking if a cached token is still valid based on a stored expiry timestamp — is self-contained and actually run with `node` using mock timestamps). Comparison table: Stripe (static secret key, no token) vs. Razorpay (static key+secret, no token) vs. PayPal (OAuth2 bearer token, must be refreshed) — highlighting PayPal as the outlier. Common mistakes: fetching a new OAuth token on EVERY API call instead of caching it until near-expiry (wasteful and can hit rate limits); not handling token expiry mid-request-burst, causing a wave of 401s. Hands-On Exercises: run the token-caching logic with mock timestamps, confirming it correctly decides whether to reuse or refresh in 3 different timing scenarios.
- `02-Orders-API-v2-Create-Approve-Capture.md`: PayPal's three-step Orders v2 flow (create order server-side → buyer approves via PayPal Smart Buttons client-side → server captures the approved order to actually collect funds) — a more explicit 3-phase split of Phase 1's general shape than Stripe/Razorpay's more collapsed flows. Topic sections: "Create → Approve → Capture," "PayPal Smart Buttons (Client-Side)," "Why Capture Is a Separate Step (Authorization vs. Capture)." Example: a Node.js snippet structure for the create-order call and the capture call using the OAuth token from Lesson 1 — syntax-checked with `node --check`, marked illustrative. Comparison table: PayPal's explicit create/approve/capture vs. Stripe's PaymentIntent (confirm does create+capture together by default, though it supports separate authorize/capture too) vs. Razorpay's order+checkout (client-side capture is typically automatic). Common mistakes: forgetting to actually call Capture after the buyer approves (an approved-but-not-captured order never collects funds and will eventually expire); not distinguishing an authorization (funds reserved) from a capture (funds actually transferred) when deciding how long you can wait before capturing. Hands-On Exercises: syntax-check the create/capture snippets; a paper exercise tracing an order through all 3 states and identifying what happens if capture is skipped.
- `03-PayPal-Webhooks-in-Practice.md`: PayPal's webhook verification model (notably MORE INVOLVED than Stripe/Razorpay's local-HMAC-check — PayPal requires calling their `/v1/notifications/verify-webhook-signature` API endpoint with the received headers and body, rather than computing the HMAC locally), key event types (`PAYMENT.CAPTURE.COMPLETED`, `PAYMENT.CAPTURE.DENIED`). Topic sections: "PayPal's API-Based Verification (vs. Local HMAC)," "Why This Differs From Stripe/Razorpay," "Key PayPal Event Types." Example: a Node.js snippet structure showing the shape of the verify-webhook-signature API call (illustrative, syntax-checked with `node --check`, needs live credentials + OAuth token from Lesson 1). Common mistakes: assuming PayPal's webhook verification is a simple local HMAC check like Stripe/Razorpay's (it requires an authenticated API round-trip, which also means it needs the OAuth token from Lesson 1 and can fail due to network issues, not just signature mismatch — a fundamentally different failure mode to handle); not caching/reusing the OAuth token for this call, mirroring Lesson 1's mistake. Hands-On Exercises: syntax-check the verify-webhook-signature call structure; a paper exercise comparing the 3 providers' webhook-verification failure modes (Stripe/Razorpay: pure signature mismatch, deterministic; PayPal: signature mismatch OR network/auth failure calling PayPal's API).

- [ ] **Step 1: Write the 3 lesson files**, explicitly citing Phase 1/2, and Lesson 1's OAuth2 caching logic must be the one piece of genuinely-executed (not just syntax-checked) code in this phase.
- [ ] **Step 2: Write the phase README.md** — Title "Phase 5: PayPal Integration." Objectives: implement the OAuth2 client-credentials flow with token caching; complete the create/approve/capture order flow; verify PayPal webhooks via their API-based verification model. Topics table, 1 day each. Estimated Time: 3 days. Next Phase → `../Phase-06-Recurring-Payments-and-Subscriptions/README.md`.
- [ ] **Step 3: Verify** — actually run the token-caching logic with mock timestamps across the 3 described scenarios; syntax-check all other snippets; standalone Comparison sections present.
- [ ] **Step 4: Commit**
  ```bash
  git add PaymentGateways/Phase-05-PayPal-Integration
  git commit -m "Add Payment Gateways Phase 5: PayPal Integration"
  ```

---

### Task 6: Phase 06 — Recurring Payments and Subscriptions

**Files:**
- Create: `PaymentGateways/Phase-06-Recurring-Payments-and-Subscriptions/README.md`
- Create: `PaymentGateways/Phase-06-Recurring-Payments-and-Subscriptions/01-Subscription-Lifecycle.md`
- Create: `PaymentGateways/Phase-06-Recurring-Payments-and-Subscriptions/02-Proration-and-Plan-Changes.md`
- Create: `PaymentGateways/Phase-06-Recurring-Payments-and-Subscriptions/03-Dunning-and-Failed-Renewals.md`

Content requirements:

- `01-Subscription-Lifecycle.md`: the common subscription state machine (trialing → active → past_due → canceled/unpaid), how each provider names/models this (Stripe Subscriptions, Razorpay Subscriptions, PayPal Billing Plans/Subscriptions). Topic sections: "The Common State Machine," "How Each Provider Models It," "Subscription Webhook Events." Example: an ASCII state diagram of the lifecycle, plus a Node.js object structure modeling subscription state transitions — actually run with `node` to demonstrate a transition function moving through states correctly. Comparison table: the three providers' subscription object names and their equivalent states. Common mistakes: not handling the `trialing → active` transition's webhook (the trial ending doesn't always mean payment succeeded); treating `past_due` as equivalent to `canceled` (a past_due subscription is still retriable, canceled is terminal). Hands-On Exercises: run the state-transition function through a full lifecycle including a failed-then-retried payment path.
- `02-Proration-and-Plan-Changes.md`: proration when a customer upgrades/downgrades mid-cycle (crediting the unused portion of the old plan, charging the prorated new plan amount), how this is calculated conceptually (days remaining / total days in cycle × price difference). Topic sections: "What Proration Solves," "The Proration Calculation," "Provider-Specific Proration Behavior (Immediate vs. Next-Cycle)." Example: a real, runnable Node.js function computing a prorated credit/charge given old price, new price, days remaining, and total cycle days — actually run with `node` against 2-3 concrete scenarios, confirming the math. Comparison table: Stripe (prorates immediately by default, configurable) vs. Razorpay (simpler plan-swap model, less granular proration) vs. PayPal (Billing Plans revision model). Common mistakes: prorating based on calendar days without accounting for the billing cycle's actual start/end (off-by-one-style errors); assuming all three providers prorate identically when their APIs actually differ meaningfully here. Hands-On Exercises: run the proration function against 3 different upgrade/downgrade scenarios and manually verify the math by hand for one of them.
- `03-Dunning-and-Failed-Renewals.md`: dunning as the process of retrying a failed recurring charge (e.g. expired card, insufficient funds) on a backoff schedule before giving up and canceling, how each provider's built-in retry logic works (Stripe Smart Retries, Razorpay's retry config, PayPal's dunning settings) and why apps often ALSO need their own reconciliation/notification logic. Topic sections: "Why Renewals Fail," "Provider-Built-In Retry Logic," "App-Level Dunning Emails and Grace Periods." Example: a Node.js function structure modeling a simple exponential-backoff retry schedule (3 retries at 1/3/7 days) — actually run with `node` to compute and print the actual retry dates given a failure date. Comparison table: default retry schedule/behavior differences across the three providers (noting these are configurable and the lesson gives general shape, not exact current defaults, since these can change — hedge appropriately, matching this course's established discipline around not hardcoding facts that drift). Common mistakes: relying solely on the provider's built-in retry without also handling the terminal "still failed after all retries" webhook event to actually cancel access/notify the user; not giving users a grace period to update their card before hard-canceling. Hands-On Exercises: run the backoff-schedule function and verify the computed retry dates are correct given a specific failure date.

- [ ] **Step 1: Write the 3 lesson files.**
- [ ] **Step 2: Write the phase README.md** — Title "Phase 6: Recurring Payments and Subscriptions." Objectives: model the subscription lifecycle correctly; compute proration; design a dunning strategy. Topics table, 1 day each. Estimated Time: 3 days. Next Phase → `../Phase-07-Refunds-Disputes-and-Chargebacks/README.md`.
- [ ] **Step 3: Verify** — actually run the state-transition function, the proration function, and the backoff-schedule function with `node`, confirming real computed output; standalone Comparison sections present; billing-schedule specifics appropriately hedged (no invented exact current default retry counts/intervals presented as permanent fact).
- [ ] **Step 4: Commit**
  ```bash
  git add PaymentGateways/Phase-06-Recurring-Payments-and-Subscriptions
  git commit -m "Add Payment Gateways Phase 6: Recurring Payments and Subscriptions"
  ```

---

### Task 7: Phase 07 — Refunds, Disputes, and Chargebacks

**Files:**
- Create: `PaymentGateways/Phase-07-Refunds-Disputes-and-Chargebacks/README.md`
- Create: `PaymentGateways/Phase-07-Refunds-Disputes-and-Chargebacks/01-Full-and-Partial-Refunds.md`
- Create: `PaymentGateways/Phase-07-Refunds-Disputes-and-Chargebacks/02-Disputes-vs-Chargebacks.md`
- Create: `PaymentGateways/Phase-07-Refunds-Disputes-and-Chargebacks/03-Evidence-Submission-and-Webhook-Events.md`

Content requirements:

- `01-Full-and-Partial-Refunds.md`: issuing a full refund (returns the entire charge) vs. a partial refund (returns a specified amount, can be issued multiple times up to the original total), that refunds are typically NOT instant to the customer (bank processing time), and how this ties to Phase 2's webhook model (a `refund` webhook confirms the refund actually processed, don't assume success just because your API call returned 200). Topic sections: "Full vs. Partial Refunds," "Refund Timing (Not Instant)," "Confirming via Webhook, Not Just the API Response." Example: a Node.js function tracking cumulative refunded amount against an original charge, rejecting a refund request that would exceed the original amount — actually run with `node` against 3 scenarios (valid partial, valid up-to-full, invalid over-refund). Comparison table: refund API call shape across the three providers (conceptually, not exact current syntax) — noting all three follow the same full/partial pattern. Common mistakes: not tracking cumulative refunds server-side and allowing a caller to accidentally refund more than the original charge (the provider API will typically reject this, but a well-designed app checks before calling, giving a better error message); treating the refund API call's 200 response as confirmation the customer has received their money (it only confirms the refund was INITIATED — same authoritative-webhook lesson as Phase 2). Hands-On Exercises: run the cumulative-refund-tracking function against the 3 scenarios and confirm the over-refund case is correctly rejected.
- `02-Disputes-vs-Chargebacks.md`: the distinction between a provider-mediated DISPUTE (customer contacts the provider or their bank, provider notifies the merchant and offers a chance to respond) and a bank-initiated CHARGEBACK (the customer's bank reverses the charge directly, often with less merchant recourse) — these terms are sometimes used loosely but the distinction matters for how much control the merchant has. Topic sections: "Disputes vs. Chargebacks — the Practical Difference," "The Dispute Lifecycle (Opened → Evidence Window → Resolved)," "Financial Impact (Dispute Fees)." Example: an ASCII diagram of the dispute lifecycle with time-boxed evidence window. Comparison table: dispute-handling terminology and evidence-window length differences across the three providers (hedged — these change, so frame as "check current provider docs for exact windows" rather than asserting a specific day count as permanent fact). Common mistakes: missing the evidence-submission deadline (an unanswered dispute is typically auto-resolved in the customer's favor); conflating "dispute" and "refund" in application logic (a dispute is not the same event as the merchant proactively issuing a refund, and needs separate handling in your data model). Hands-On Exercises: a paper exercise designing a database schema field distinguishing "refunded" from "disputed" order states, and what UI/notification each should trigger.
- `03-Evidence-Submission-and-Webhook-Events.md`: what "evidence" typically means in a dispute response (proof of delivery, customer communication, terms-of-service acceptance), how each provider surfaces the evidence-submission API/dashboard, and the specific webhook events that drive an app's dispute-handling logic (`charge.dispute.created`, `charge.dispute.closed` style events — provider-specific names, generalizing Phase 2's model). Topic sections: "What Counts as Evidence," "Submitting Evidence Programmatically vs. via Dashboard," "Dispute Webhook Events and State Tracking." Example: a Node.js function modeling a dispute-state-tracking object that transitions through `needs_response → under_review → won/lost` based on incoming webhook event names — actually run with `node` feeding it a sequence of mock events and confirming correct state transitions. Common mistakes: only tracking the "dispute created" event and not the terminal "dispute closed (won/lost)" event, leaving the app's internal state stuck at "needs_response" forever; not automatically flagging orders under dispute in customer-facing UI/support tools, causing confused duplicate support responses. Hands-On Exercises: run the dispute-state-tracking function through a full won and a full lost sequence, confirming both terminal states are reached correctly.

- [ ] **Step 1: Write the 3 lesson files.**
- [ ] **Step 2: Write the phase README.md** — Title "Phase 7: Refunds, Disputes, and Chargebacks." Objectives: issue refunds correctly with cumulative tracking; distinguish disputes from chargebacks; model dispute state transitions from webhook events. Topics table, 1 day each. Estimated Time: 3 days. Next Phase → `../Phase-08-Security-and-Compliance/README.md`.
- [ ] **Step 3: Verify** — actually run the cumulative-refund-tracking function and the dispute-state-tracking function with `node`, confirming real output; standalone Comparison sections present; dispute-window/timing specifics appropriately hedged.
- [ ] **Step 4: Commit**
  ```bash
  git add PaymentGateways/Phase-07-Refunds-Disputes-and-Chargebacks
  git commit -m "Add Payment Gateways Phase 7: Refunds, Disputes, and Chargebacks"
  ```

---

### Task 8: Phase 08 — Security and Compliance

**Files:**
- Create: `PaymentGateways/Phase-08-Security-and-Compliance/README.md`
- Create: `PaymentGateways/Phase-08-Security-and-Compliance/01-PCI-DSS-Compliance-Levels.md`
- Create: `PaymentGateways/Phase-08-Security-and-Compliance/02-Tokenization.md`
- Create: `PaymentGateways/Phase-08-Security-and-Compliance/03-3D-Secure-and-SCA.md`

Content requirements:

- `01-PCI-DSS-Compliance-Levels.md`: expands on Phase 1 Lesson 2's SAQ overview into the merchant compliance LEVELS (Level 1-4, based on annual transaction volume, not integration architecture — a DIFFERENT axis than SAQ type), and how hosted-checkout integrations (per Phase 1) keep most apps at the lowest-burden SAQ type regardless of level. Topic sections: "Compliance Levels (by Transaction Volume) vs. SAQ Type (by Architecture) — Two Different Axes," "Why Most Apps Using Hosted Checkout Stay at SAQ A," "What Actually Changes Your Level/SAQ Type." Comparison table: Level 1-4 criteria (volume-based, hedged since exact thresholds are set by card networks and can shift) vs. SAQ A/A-EP/D (architecture-based, from Phase 1). Common mistakes: conflating "PCI compliance level" (volume-based, mostly about audit requirements) with "how much of my code touches card data" (architecture-based, what actually matters for engineering decisions); assuming compliance is a one-time checkbox rather than an annual re-attestation. Hands-On Exercises: a paper exercise classifying 3 sample businesses by their likely compliance level based on described transaction volume, and separately by SAQ type based on described architecture — reinforcing the two-axis distinction.
- `02-Tokenization.md`: how tokenization replaces a raw card number with a provider-generated opaque token, usable for future charges (saved cards) without your server ever storing/re-seeing the actual PAN, how this differs from hosted fields (Phase 1) — hosted fields prevent your server from EVER seeing raw card data at charge time; tokenization is specifically about REUSING a payment method later without re-collecting card details. Topic sections: "What a Token Actually Represents," "Saved Cards / Reusable Payment Methods," "Tokens Are Provider-Specific (Not Portable Between Stripe/Razorpay/PayPal)." Example: a Node.js object structure modeling "save this token, charge it again later" without ever storing a PAN — illustrative, syntax-checked with `node --check`. Comparison table: Stripe's Payment Methods/Customer object vs. Razorpay's saved cards/tokens vs. PayPal's vault — conceptually similar, provider-specific APIs. Common mistakes: assuming a Stripe token can be used to charge via Razorpay or vice versa (tokens are NOT portable across providers — switching providers means re-collecting payment methods from all existing customers, a real migration cost worth knowing about); storing a token without also storing enough metadata (last 4 digits, expiry) to show a user "which card" without re-fetching from the provider on every page load. Hands-On Exercises: a paper exercise designing a database schema for storing a saved-payment-method reference (token + display metadata, NOT raw card data).
- `03-3D-Secure-and-SCA.md`: 3D Secure (3DS) as an additional authentication step (redirecting to the card issuer's bank for a one-time code or biometric confirmation) required for Strong Customer Authentication (SCA) under EU/UK's PSD2 regulation, how this appears in each provider's flow as an extra "requires_action"-style status requiring a redirect (ties back to Stripe's `requires_action` status from Phase 3 Lesson 2). Topic sections: "What 3D Secure Actually Does," "SCA and PSD2 (Who This Applies To)," "Handling the Extra Redirect/Challenge Step in Code." Example: an ASCII flow diagram showing a payment flow with a 3DS challenge inserted between confirmation and success. Comparison table: how each provider surfaces the 3DS requirement (Stripe's `requires_action`/`next_action`, generalized similarly across Razorpay/PayPal's own redirect-based challenge flows). Common mistakes: only testing the happy path (no 3DS challenge) in development and being surprised when EU customers hit the extra step in production; not setting a reasonable timeout/abandonment handling for a customer who starts but never completes a 3DS challenge (the payment session shouldn't hang indefinitely). Hands-On Exercises: a paper exercise tracing a payment through the full happy-path-with-3DS-challenge flow, identifying every state the payment object passes through.

- [ ] **Step 1: Write the 3 lesson files**, explicitly building on Phase 1's SAQ overview and Phase 3's `requires_action` status.
- [ ] **Step 2: Write the phase README.md** — Title "Phase 8: Security and Compliance." Objectives: distinguish PCI compliance level from SAQ type; understand tokenization's role and its provider-lock-in implication; handle 3D Secure/SCA challenge flows. Topics table, 1 day each. Estimated Time: 3 days. Next Phase → `../Phase-09-Multi-Currency-and-International-Payments/README.md`.
- [ ] **Step 3: Verify** — every code snippet syntax-checked; standalone Comparison sections present; PCI level thresholds and SCA regulatory specifics appropriately hedged (framed as general shape, not exact current legal thresholds).
- [ ] **Step 4: Commit**
  ```bash
  git add PaymentGateways/Phase-08-Security-and-Compliance
  git commit -m "Add Payment Gateways Phase 8: Security and Compliance"
  ```

---

### Task 9: Phase 09 — Multi-Currency and International Payments

**Files:**
- Create: `PaymentGateways/Phase-09-Multi-Currency-and-International-Payments/README.md`
- Create: `PaymentGateways/Phase-09-Multi-Currency-and-International-Payments/01-Minor-Units-and-Currency-Handling.md`
- Create: `PaymentGateways/Phase-09-Multi-Currency-and-International-Payments/02-Regional-Provider-Availability.md`
- Create: `PaymentGateways/Phase-09-Multi-Currency-and-International-Payments/03-Settlement-vs-Presentment-Currency.md`

Content requirements:

- `01-Minor-Units-and-Currency-Handling.md`: resolves the "cents vs. paise vs. whole units" gotcha flagged in Phases 3-4 — most currencies use a 2-decimal minor unit (USD cents, INR paise: multiply by 100), but some currencies have 0 decimal places (JPY: no multiplication) and others have 3 (e.g. Bahraini Dinar: multiply by 1000) — a genuinely common source of by-factor-of-100 bugs. Topic sections: "The General Rule (Multiply by 10^decimal_places)," "Zero-Decimal Currencies (JPY and Others)," "Three-Decimal Currencies (the Rare Case)." Example: a real, runnable Node.js function converting a decimal amount to minor units given a currency's decimal-places count, actually run with `node` against USD (2 decimals), JPY (0 decimals), and a 3-decimal currency, confirming correct output for all three. Comparison table: how Stripe/Razorpay/PayPal each expect amounts (conceptually all minor-unit-based, but confirm/hedge on exact currency-list specifics since provider-supported-currency lists change). Common mistakes: hardcoding "multiply by 100" as a universal rule (breaks for JPY, silently overcharging by 100x); not looking up a currency's actual decimal-place count before shipping support for a new market. Hands-On Exercises: run the minor-unit conversion function against 5 different currencies including at least one zero-decimal and confirm all outputs by hand.
- `02-Regional-Provider-Availability.md`: why Razorpay is the dominant choice for India-specific payment methods (UPI, India-specific card networks, local bank transfers) that Stripe/PayPal don't natively support as deeply, while Stripe/PayPal have broader global reach — this isn't a "better/worse" comparison but a "which markets does each provider actually serve well" question. Topic sections: "Why Provider Choice Is Market-Dependent, Not Just Feature-Dependent," "India-Specific Payment Methods (UPI, etc.)," "Global Reach Considerations." Comparison table: rough regional strength by provider (India: Razorpay strong; US/EU/global: Stripe/PayPal strong) — framed as general market positioning, explicitly hedged as changing over time and worth verifying against current provider documentation before a real business decision. Common mistakes: choosing a single global provider for an India-first product and missing UPI (a payment method many Indian customers expect); assuming provider coverage is static — providers expand into new markets/methods over time, so this needs periodic re-verification, not a one-time decision. Hands-On Exercises: a paper exercise given a target market (e.g. "primarily Indian customers," "primarily US/EU customers," "global with no single dominant market") and asked to justify a provider choice based on this lesson's framework.
- `03-Settlement-vs-Presentment-Currency.md`: the presentment currency (what the customer sees/pays in) can differ from the settlement currency (what actually lands in the merchant's bank account) — providers may auto-convert, sometimes with a currency-conversion fee, and merchants need to understand which currency their payout account actually receives. Topic sections: "Presentment vs. Settlement Currency," "Currency Conversion Fees," "Multi-Currency Payout Accounts (When Providers Support Them)." Example: a Node.js function modeling a presentment-to-settlement conversion given an exchange rate and a conversion fee percentage, actually run with `node` against a concrete example. Common mistakes: assuming the amount charged to the customer is exactly what arrives in the merchant's bank account (ignoring conversion fees and exchange-rate timing); not clearly displaying the presentment currency to the customer, causing confusion when their bank statement shows a different converted amount. Hands-On Exercises: run the settlement-conversion function against 2-3 exchange-rate/fee scenarios and verify the math.

- [ ] **Step 1: Write the 3 lesson files.**
- [ ] **Step 2: Write the phase README.md** — Title "Phase 9: Multi-Currency and International Payments." Objectives: convert amounts to minor units correctly for any currency including edge cases; reason about provider choice by target market; understand settlement vs. presentment currency. Topics table, 1 day each. Estimated Time: 3 days. Next Phase → `../Phase-10-Choosing-Providers-and-Production-Best-Practices/README.md`.
- [ ] **Step 3: Verify** — actually run the minor-unit conversion function (5 currencies) and the settlement-conversion function with `node`, confirming real output; standalone Comparison sections present; regional-availability claims appropriately hedged as changing over time.
- [ ] **Step 4: Commit**
  ```bash
  git add PaymentGateways/Phase-09-Multi-Currency-and-International-Payments
  git commit -m "Add Payment Gateways Phase 9: Multi-Currency and International Payments"
  ```

---

### Task 10: Phase 10 — Choosing Providers and Production Best Practices

**Files:**
- Create: `PaymentGateways/Phase-10-Choosing-Providers-and-Production-Best-Practices/README.md`
- Create: `PaymentGateways/Phase-10-Choosing-Providers-and-Production-Best-Practices/01-Stripe-vs-Razorpay-vs-PayPal-Comparison.md`
- Create: `PaymentGateways/Phase-10-Choosing-Providers-and-Production-Best-Practices/02-Testing-Strategies-and-Sandbox-Tools.md`
- Create: `PaymentGateways/Phase-10-Choosing-Providers-and-Production-Best-Practices/03-Monitoring-and-Interview-Capstone.md`

Content requirements:

- `01-Stripe-vs-Razorpay-vs-PayPal-Comparison.md`: synthesizes the whole course into one decision framework — fee structure shape (percentage + fixed fee, hedged on exact current numbers since these change), supported countries/currencies (tying to Phase 9), developer experience/SDK quality, feature parity for subscriptions/disputes/etc (tying to Phases 6-7). Topic sections: "Fee Structure Shape (Not Exact Numbers)," "Developer Experience and SDK Quality," "Feature Parity Recap." Comparison table: the single most comprehensive table in the course, one row per dimension (fees, regional strength, subscription support, dispute handling, webhook verification complexity from Phases 3-5) times one column per provider — every cell filled, and every claim traceable back to an earlier phase's lesson rather than asserted fresh here. Common mistakes: choosing a provider based on fees alone without checking regional/feature fit (Phase 9); not accounting for integration complexity differences (e.g. PayPal's OAuth2 requirement from Phase 5) when estimating engineering time. Hands-On Exercises: a paper exercise given 3 different hypothetical product requirements, recommending a provider (or combination) for each with justification citing specific earlier-phase lessons.
- `02-Testing-Strategies-and-Sandbox-Tools.md`: each provider's sandbox/test-mode conventions (from Phase 1), test card numbers for simulating success/decline/3DS-required scenarios (ties to Phase 8), webhook testing tools (Stripe CLI's `stripe listen`, from Phase 3; Razorpay/PayPal's dashboard-based webhook testing or ngrok-based local tunneling as the general-purpose alternative). Topic sections: "Test Cards for Simulating Outcomes," "Local Webhook Testing (Stripe CLI vs. ngrok-Style Tunneling)," "A Suggested Test Matrix (Happy Path, Decline, 3DS, Refund, Dispute)." Example: a Node.js/shell snippet showing an `ngrok http 3000`-style local tunnel setup as the provider-agnostic fallback for providers without a CLI tool like Stripe's. Common mistakes: only testing the happy path and shipping without ever exercising a decline or 3DS-challenge path in a staging environment; forgetting to also test webhook re-delivery/idempotency (Phase 2) in a staging environment, not just the happy-path single-delivery case. Hands-On Exercises: design (paper exercise) a test matrix table covering at least 5 distinct scenarios (happy path, card decline, 3DS challenge, webhook retry, refund) across the 3 providers.
- `03-Monitoring-and-Interview-Capstone.md`: monitoring failed payments and webhook delivery health in production (alerting on a spike in failed webhook deliveries, reconciliation jobs comparing your database state against the provider's dashboard/API as a safety net for Phase 2's "what if a webhook never arrives" concern), and an interview-strategy capstone (how payment-integration questions get asked in interviews — "design a checkout flow," "how would you handle a webhook that arrives twice," "how would you support both Stripe and Razorpay behind one interface") with a framework for structuring an answer, citing real file paths from earlier phases. Topic sections: "Monitoring Webhook Delivery Health," "Reconciliation Jobs as a Safety Net," "Interview Framework and a Worked Example." Example: a worked-through sample interview question ("design a payment flow that supports both Stripe and Razorpay") walked through the answer framework, citing real file paths from this course (verify each cited path actually exists via `test -f`). Common mistakes: having webhook handling but no reconciliation job, silently losing orders when a webhook delivery permanently fails; in an interview setting, jumping straight to provider-specific API syntax before establishing the provider-agnostic shape (Phase 1) an interviewer is actually assessing. Hands-On Exercises: a paper exercise designing a reconciliation job's pseudocode (compare local "pending" orders older than N minutes against the provider's API, flag mismatches).

- [ ] **Step 1: Write the 3 lesson files.**
- [ ] **Step 2: Write the phase README.md** — Title "Phase 10: Choosing Providers and Production Best Practices." Objectives: choose a provider (or combination) using a structured framework; design a thorough test matrix; monitor payment health in production and structure a strong interview answer. Topics table, 1 day each. Estimated Time: 3 days. Next Phase → `../Projects/README.md`.
- [ ] **Step 3: Verify** — every cited file path in file 03 verified via `test -f`; the comprehensive Phase 10 Lesson 1 comparison table cross-checked against claims actually made in Phases 3-9 (no fresh unsupported claims); standalone Comparison sections present.
- [ ] **Step 4: Commit**
  ```bash
  git add PaymentGateways/Phase-10-Choosing-Providers-and-Production-Best-Practices
  git commit -m "Add Payment Gateways Phase 10: Choosing Providers and Production Best Practices"
  ```

---

### Task 11: Projects/ — End-to-End Builds

**Files:**
- Create: `PaymentGateways/Projects/README.md`
- Create: `PaymentGateways/Projects/01-Unified-Checkout-Interface.md`
- Create: `PaymentGateways/Projects/02-Subscription-Billing-System-with-Dunning.md`
- Create: `PaymentGateways/Projects/03-Webhook-Driven-Refund-and-Dispute-Pipeline.md`

- [ ] **Step 1: Write `README.md`** — explain the purpose (combining patterns from multiple phases into end-to-end builds), list all 3 projects in a table (`File | Patterns Combined | Phases`):
  - `01-Unified-Checkout-Interface.md` — Phase 1's 3-step shape + Phases 3/4/5's provider specifics, behind one interface — Phases 1, 3, 4, 5
  - `02-Subscription-Billing-System-with-Dunning.md` — subscription lifecycle + dunning — Phase 6
  - `03-Webhook-Driven-Refund-and-Dispute-Pipeline.md` — webhook idempotency + refunds/disputes — Phases 2, 7

- [ ] **Step 2: Write the 3 project files**, each with `## Problem Statement`, `## Approach Discussion`, `## Solution` (Node.js code, syntax-checked with `node --check` for anything requiring live credentials, actually run with `node` for any self-contained logic like signature verification or state machines), `## Trade-offs and Considerations`:
  - `01-Unified-Checkout-Interface.md`: a single `createPayment({provider, amount, currency})` function that dispatches to provider-specific create-order/create-PaymentIntent logic behind one interface, unifying Phase 1's shape across Phases 3/4/5's specifics. Solution includes a real, runnable Node.js module structure with a common interface and 3 provider adapter stubs (illustrative for the live-API parts, but the DISPATCH LOGIC itself — routing to the correct adapter based on a `provider` field — actually run with `node` against mock adapters). Trade-offs: discuss the abstraction leaking at points where providers genuinely differ (PayPal's OAuth2 requirement, Razorpay's dual signature check) and how much to paper over vs. expose.
  - `02-Subscription-Billing-System-with-Dunning.md`: combines Phase 6's subscription state machine and backoff-schedule dunning logic into one system — actually run with `node`, tracing a subscription through trial → active → a failed renewal → dunning retries → eventual cancellation. Trade-offs: discuss when to give up retrying vs. keep trying, and grace-period UX considerations.
  - `03-Webhook-Driven-Refund-and-Dispute-Pipeline.md`: combines Phase 2's idempotent-handler pattern and Phase 7's refund/dispute state tracking into one webhook processing pipeline — actually run with `node`, feeding it a sequence of mock webhook events (including a duplicate delivery) and confirming correct, idempotent state updates. Trade-offs: discuss where to put the dedup-by-event-ID store in a real system (database table vs. cache) and its own failure modes.

- [ ] **Step 3: Verify** — actually run every project's core logic (dispatch logic, subscription+dunning trace, webhook pipeline with a duplicate event) with `node`, confirming real output.
- [ ] **Step 4: Commit**
  ```bash
  git add PaymentGateways/Projects
  git commit -m "Add Payment Gateways Projects: 3 end-to-end builds"
  ```

---

### Task 12: Quick-Reference/ — Cheatsheet and Interview Q&A

**Files:**
- Create: `PaymentGateways/Quick-Reference/Cheatsheet.md`
- Create: `PaymentGateways/Quick-Reference/Interview-QA.md`

- [ ] **Step 1: Write `Cheatsheet.md`** — dense, topic-organized tables (matching `Git/Git-Cheatsheet.md`'s style): webhook signature-verification snippet per provider (condensed from Phases 3-5); minor-unit conversion table for common currencies (from Phase 9); HTTP status/error-handling conventions per provider; the OAuth2 token-caching pattern (from Phase 5) as a reusable snippet. Pulled directly from patterns established in the phase lessons, not new content.
- [ ] **Step 2: Write `Interview-QA.md`** — 50 questions with answers, grouped: Q1-15 Fundamentals/Webhooks (Phases 1-2), Q16-30 Provider-Specific (Phases 3-5), Q31-40 Subscriptions/Refunds/Disputes (Phases 6-7), Q41-50 Security/Currency/Production (Phases 8-10).
- [ ] **Step 3: Verify** — `grep -c '^Q' PaymentGateways/Quick-Reference/Interview-QA.md` (or equivalent numbering check) confirms 50; every code snippet in the Cheatsheet syntax-checked with `node --check` or actually run where self-contained.
- [ ] **Step 4: Commit**
  ```bash
  git add PaymentGateways/Quick-Reference
  git commit -m "Add Payment Gateways Quick-Reference: cheatsheet and interview Q&A"
  ```

---

### Task 13: Course-level README.md

**Files:**
- Create: `PaymentGateways/README.md`

- [ ] **Step 1: Write the course README** — `## Overview` (payment integration from provider-agnostic fundamentals through Stripe/Razorpay/PayPal specifics to production practices, framed for both integration work and interview prep); `## Course Structure` (the tree from the spec); `## Learning Path` table (`Phase | Topic | Difficulty | Time`, 10 rows + Projects row); `## Prerequisites` (basic Node.js/JavaScript familiarity, basic HTTP/REST API familiarity — both taught-from-scratch-enough but assumed at a basic level); link to `Phase-01-Payment-Fundamentals/README.md`.
- [ ] **Step 2: Verify all internal links resolve** — `grep -oE '\]\([^)]+\.md[^)]*\)' PaymentGateways/README.md` and confirm each referenced path exists via `ls`/`test -f`.
- [ ] **Step 3: Commit**
  ```bash
  git add PaymentGateways/README.md
  git commit -m "Add Payment Gateways course README"
  ```

---

## Self-Review Notes

- **Spec coverage:** All 10 phases covered (Tasks 1-10, each with phase README per standard convention), Projects/ with 3 end-to-end builds (Task 11), Quick-Reference/ with both required files (Task 12), course README (Task 13).
- **Lesson format chosen upfront:** every phase task uses the topic-headed template (no narrative-8-section-then-reformat detour), directly incorporating every lesson learned from the GithubActions reformat: standalone Comparison sections with every cell filled, code interleaved not concentrated, direct Interview Q&A, and — critically — an explicit instruction in every task to sanity-check Hands-On Exercises for logical self-consistency by tracing multi-step sequences, since that exact bug class recurred repeatedly in the GithubActions build.
- **Execution-verification discipline carried over:** every task requires actually running self-contained Node.js logic (signature verification, state machines, proration math, currency conversion, dispute tracking) with real captured output, and honestly marking anything requiring live API credentials as illustrative/syntax-checked rather than fabricating API response data.
- **Cross-references are real dependencies, not decoration:** Phases 3-5 (provider integrations) are deliberately kept short by building on Phases 1-2's general concepts rather than re-teaching them — this is load-bearing for the "why a unified course" rationale in the spec, so tasks explicitly require citing back accurately rather than just mentioning phase numbers.
- **Hedging discipline:** fee amounts, exact compliance thresholds, exact regional availability, and exact default retry schedules are all explicitly flagged in their tasks as needing hedged language ("verify against current docs") rather than hardcoded facts that will drift — matching the GithubActions course's established, reviewer-enforced discipline around this exact failure mode.
