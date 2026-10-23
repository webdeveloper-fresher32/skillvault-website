# PCI DSS Compliance Levels

Phase 1's Lesson 2 covered SAQ type — the questionnaire tier your architecture qualifies for based on whether raw card data ever touches your server. This lesson covers a different, easily-confused axis: your merchant "Level" (1 through 4), which card networks assign based on how many transactions you process annually, regardless of how your checkout is built.

## 1. Compliance Levels vs. SAQ Type — Two Different Axes

A PCI compliance Level and a SAQ type answer two unrelated questions. Level answers "how much card-present/card-not-present volume does this merchant push through the card networks per year?" — it's assigned by the card networks (Visa, Mastercard, etc.) and drives *how rigorously* you must validate compliance (self-assessment vs. mandatory third-party audit). SAQ type answers "which questionnaire matches how cardholder data flows through my specific systems?" — it's about architecture, not volume. A merchant can be a small Level 4 business and still land on SAQ D if they built a custom card form; a huge Level 1 merchant can still qualify for SAQ A if every integration is fully hosted/redirect-based.

```text
Level (1-4)          →  driven by: annual transaction VOLUME (network-assigned)
                         answers: "how strict is our validation process?"

SAQ type (A/A-EP/D)  →  driven by: how cardholder data FLOWS through your systems
                         answers: "which questionnaire do we fill out, and how much
                                   of our infrastructure is in scope?"
```

## 2. Why Most Apps Using Hosted Checkout Stay at SAQ A

Volume (Level) can grow every year as a business scales, but that growth doesn't by itself change what your code does with card data. If a startup launches with Stripe Checkout Sessions or Razorpay Checkout (Phase 1's "hosted, redirect-based" row) and never introduces a custom card form, raw PAN never touches their server on day one *or* at 10 million transactions a year later. The Level attached to that merchant climbs as volume climbs — potentially requiring a more rigorous validation process — but the SAQ type it validates against typically stays SAQ A the entire time, because the architecture never changed. This is precisely why hosted checkout is attractive beyond the initial PCI-scope win from Phase 1: it decouples "we grew" from "we now have more compliance work to redesign around."

## 3. What Actually Changes Your Level or SAQ Type

Your Level changes when your annual transaction volume crosses a threshold set by the card networks — exact figures are set and occasionally revised by Visa/Mastercard/etc., so treat any specific number as a rough planning figure and verify the current thresholds directly with your acquiring bank or processor before treating a number as fact. Your SAQ type changes only when your architecture changes — for example, moving from a hosted redirect to a custom card form (SAQ A → SAQ D), or adding a script to your checkout page that can influence the hosted iframe (SAQ A → SAQ A-EP, exactly as Phase 1's Lesson 2 described). Volume and architecture are independent variables that happen to both feed into "how much compliance work am I doing this year."

## Comparison

| Level | Rough Annual Volume (card-network-assigned — verify current thresholds) | Typical Validation Requirement | Independent of... |
|---|---|---|---|
| Level 1 | Roughly on the order of 6 million+ transactions/year across a card brand (large merchants) | Typically an annual on-site assessment by a Qualified Security Assessor (QSA), plus quarterly network scans | Which SAQ type applies — a Level 1 merchant using only hosted checkout can still validate against SAQ A's control set |
| Level 2 | Roughly on the order of 1-6 million transactions/year | Typically an annual SAQ (sometimes still requiring a QSA depending on the card network), plus quarterly scans | Same — SAQ type still depends on architecture, not this volume band |
| Level 3 | Roughly on the order of 20,000-1 million e-commerce transactions/year | Typically an annual SAQ, plus quarterly scans | Same |
| Level 4 | Below the Level 3 threshold — most small/early-stage merchants | Typically an annual SAQ (requirements can vary by acquiring bank), scans as required | Same |
| SAQ A | N/A (architecture-based, not volume-based) | Shortest questionnaire, no on-site scanning of your servers | Applies at any Level, as long as the architecture fully outsources card capture (Phase 1, Lesson 2) |
| SAQ A-EP | N/A (architecture-based) | Moderate — network scans plus more extensive controls | Applies at any Level, when your page's own script can influence a hosted field |
| SAQ D | N/A (architecture-based) | Full requirement set, often a QSA audit | Applies at any Level, when your server directly touches raw PAN |

## Common Mistakes

- Conflating "our PCI compliance Level" (a volume-based bucket assigned by card networks) with "how much of our code touches card data" (an architecture-based SAQ type) — a business can quote its Level in a security review and still be answering the wrong question if what's actually being asked is which SAQ applies.
- Assuming compliance is a one-time checkbox rather than a periodic re-attestation — both Level (as volume changes) and SAQ validation (typically annual, alongside quarterly scans where applicable) need to be revisited on a recurring cadence, not signed off once and forgotten.
- Treating the exact volume thresholds between Levels as fixed, permanent numbers — they are set by the card networks and have been revised over time, so any number quoted here (or anywhere) should be verified against current network/acquirer documentation before it's used to make a real compliance decision.
- Assuming a jump in transaction Level automatically forces an architecture rewrite — it doesn't, as long as the existing architecture (e.g., hosted checkout) already keeps you at the SAQ type appropriate for however much validation rigor the new Level requires.

## Hands-On Exercises

1. **Classify by Level (paper exercise).** For each business below, write down which Level (1-4) it most likely falls into, based on rough order-of-magnitude volume, and note that you would verify the exact threshold with a real acquirer before treating it as final:
   - (a) A regional grocery delivery startup processing roughly 40,000 card transactions per year.
   - (b) A mid-sized e-commerce retailer processing roughly 2 million card transactions per year.
   - (c) A national retail chain processing roughly 20 million card transactions per year across in-store and online sales.

   Answers (order-of-magnitude only): (a) Level 4 — well under the smallest e-commerce threshold band. (b) Level 2 — squarely in the multi-million but sub-6-million band. (c) Level 1 — well above the largest-merchant threshold.

2. **Classify by SAQ type (paper exercise).** For each architecture below, write down the SAQ type using Phase 1 Lesson 2's actual table:
   - (a) A checkout that redirects entirely to a provider-hosted page (e.g., a Checkout Session).
   - (b) A checkout using a hosted iframe for card fields, with an unrelated third-party chat widget script also present on the same page that doesn't touch the payment form.
   - (c) A checkout with a custom `<input>` card form posted directly to the merchant's own server.

   Answers: (a) SAQ A. (b) SAQ A — the unrelated script doesn't influence the payment form. (c) SAQ D.

3. **Combine both axes.** Take business (c) from Exercise 1 (the national retail chain, Level 1) and assume it uses the hosted-checkout architecture from Exercise 2(a). Write one or two sentences explaining why this merchant is Level 1 *and* SAQ A simultaneously, and why that combination isn't a contradiction.

4. **Spot the confusion.** A teammate says, "We're a small startup, so we don't need to worry about PCI compliance." Write two or three sentences correcting this, distinguishing Level (which might indeed be low, i.e., Level 4) from the fact that SAQ obligations still apply at any Level, including Level 4.

## Interview Q&A

**Q: What's the core difference between a PCI compliance Level and a SAQ type?**
A: Level is a volume-based bucket (1-4) assigned by card networks based on annual transaction count, driving how rigorous your validation process must be. SAQ type is an architecture-based classification (A/A-EP/D) driven by how cardholder data actually flows through your systems. They're independent axes.

**Q: Can a high-Level (large-volume) merchant still qualify for the lowest-burden SAQ A?**
A: Yes — if their architecture fully outsources card data capture to a hosted field or redirect (per Phase 1's Lesson 2), volume alone doesn't push them to a stricter SAQ type; a large Level 1 merchant using only hosted checkout can still validate against SAQ A's control set.

**Q: What actually changes a merchant's SAQ type?**
A: A change in architecture — for example, moving from a hosted redirect/iframe to a custom card form that touches your own server, or adding a script that can influence a hosted payment field. Volume growth alone doesn't change SAQ type.

**Q: Should you treat the exact transaction-count thresholds between Levels as fixed numbers you can rely on indefinitely?**
A: No — they're set by the card networks and have shifted over time; treat any quoted figure as a rough planning estimate and verify current thresholds with your acquiring bank or processor before making a real compliance decision.

**Q: Is PCI compliance something you validate once and never revisit?**
A: No — both your Level (as volume changes year over year) and your SAQ validation (typically an annual re-attestation, plus periodic scans where applicable) require ongoing, recurring compliance work, not a one-time checkbox.
