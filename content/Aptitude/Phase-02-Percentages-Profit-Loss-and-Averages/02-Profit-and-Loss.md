# Profit and Loss — Complete Guide

## Table of Contents
1. [Concept](#1-concept)
2. [Shortcut / Trick](#2-shortcut--trick)
3. [Worked Examples](#3-worked-examples)
4. [Timed Practice Set](#4-timed-practice-set)

---

## 1. Concept

Every profit-and-loss question is built from just two numbers: **Cost Price (CP)** — what the seller paid — and **Selling Price (SP)** — what the buyer paid. Everything else (profit%, loss%, marked price, discount) is a derived relationship between these two. This topic shows up constantly because it's really just percentages wearing a shopkeeper's apron — the same successive-change and reverse-percentage tricks from the previous lesson reappear here as "successive discounts" and "find CP given SP and loss%."

There's also a well-known dishonest-dealer variant: a trader claims to sell "at cost price, no profit" but secretly uses an underweight measure (a "1 kg" weight that's really 900 g). Even though he charges the fair per-kg price, he's actually giving less product for the same money — which is a hidden profit. This lesson gives you a one-line formula for that trick instead of having to reconstruct it from scratch every time.

**Plain-English example:** A shopkeeper buys a fan for ₹1,000 and sells it for ₹1,150. Profit = ₹150, and profit% = 150/1000 × 100 = 15%. That's the entire foundation — everything below is just this same idea applied to trickier setups (discounts on a marked-up price, or a dealer who never actually loses anything).

---

## 2. Shortcut / Trick

### Core formulas

$$\text{Profit} = SP - CP \quad (\text{when } SP > CP) \qquad \text{Loss} = CP - SP \quad (\text{when } CP > SP)$$

$$\text{Profit\%} = \frac{\text{Profit}}{CP} \times 100 \qquad \text{Loss\%} = \frac{\text{Loss}}{CP} \times 100$$

**Always divide by CP, never by SP** — this is the single most common error in this topic.

To go the other direction (CP/loss% or profit% → SP), rewrite as a multiplier:

$$SP = CP \times \left(1 + \frac{\text{Profit\%}}{100}\right) \qquad SP = CP \times \left(1 - \frac{\text{Loss\%}}{100}\right)$$

### Marked price and discount

The **Marked Price (MP)** is the sticker/label price before any discount; the **discount** is always applied to MP, not to CP:

$$SP = MP \times \left(1 - \frac{\text{Discount\%}}{100}\right)$$

Two successive discounts combine with the exact same successive-percentage-change formula from the Percentages lesson (treat both as negative values):

$$\text{Net discount \%} = a + b + \frac{ab}{100}$$

### False weight trick

If a dealer claims to sell at cost price (zero profit) but uses a weight/measure that is short of the true value by some **error**, the hidden profit percentage is:

$$\text{Profit\%} = \frac{\text{Error}}{\text{True value} - \text{Error}} \times 100$$

Here "true value" is what the customer is told they're getting (e.g., 1000 g), and "error" is the shortfall (e.g., 100 g if only 900 g is actually given).

---

## 3. Worked Examples

### (a) CP = ₹800, profit = 15%. Find SP.

$$SP = 800 \times \left(1 + \frac{15}{100}\right) = 800 \times 1.15 = \textbf{₹920}$$

### (b) Find the single discount equivalent to successive discounts of 20% and 10%

a = −20, b = −10.

Net discount % = (−20) + (−10) + [(−20)(−10)/100] = −30 + 2 = **−28%**, i.e., a single **28% discount**.

**Check directly:** Start at ₹100 → 20% off → ₹80 → 10% off → ₹72. That's a 28% drop from 100. Matches — note it is *not* 30%, which is the common wrong answer from just adding the two discounts.

### (c) A dishonest dealer claims to sell at cost price but uses a 900 g weight instead of 1 kg. Find his profit%.

True value = 1000 g, actual given = 900 g, so error (shortfall) = 100 g.

$$\text{Profit\%} = \frac{100}{1000 - 100} \times 100 = \frac{100}{900} \times 100 = \textbf{11.11\%}$$

**Why this works:** the dealer collects money as if he handed over 1000 g but his actual cost was only for 900 g. His profit is the 100 g he kept back, measured against what he *actually spent* (900 g worth), not against the 1000 g he pretended to give — which is exactly why the denominator is (true value − error), not the true value itself.

---

## 4. Timed Practice Set

1. CP = ₹500, SP = ₹575. Find the profit percentage. (30 sec)
2. An article bought for ₹1,200 is sold at a 10% loss. Find the selling price. (30 sec)
3. A marked price of ₹2,500 is discounted by 12%. Find the selling price. (30 sec)
4. Find the single discount equivalent to successive discounts of 10% and 5%. (45 sec)
5. A dealer sells goods at cost price but uses a 950 g weight instead of 1 kg. Find his profit percentage. (45 sec)
6. An article is sold for ₹850 at a 15% loss. Find the cost price. (30 sec)
7. If SP = 1.2 × CP, find the profit percentage. (20 sec)
8. A shopkeeper marks his goods 40% above cost price and then gives a 10% discount on the marked price. Find his profit percentage. (45 sec)

### Answer Key

1. **15%** — profit = 575 − 500 = 75; 75/500 × 100 = 15%.
2. **₹1,080** — SP = 1200 × (1 − 0.10) = 1200 × 0.90 = 1080.
3. **₹2,200** — SP = 2500 × (1 − 0.12) = 2500 × 0.88 = 2200.
4. **14.5%** — net = (−10) + (−5) + [(−10)(−5)/100] = −15 + 0.5 = −14.5%.
5. **5.26%** — error = 50 g, true value − error = 950 g; 50/950 × 100 ≈ 5.26%.
6. **₹1,000** — CP × (1 − 0.15) = 850 → CP = 850/0.85 = 1000.
7. **20%** — SP = 1.2 CP means profit = 0.2 CP, i.e., 20% profit.
8. **26%** — MP = 1.4 CP; SP = MP × 0.9 = 1.4 × 0.9 × CP = 1.26 CP → profit = 0.26 CP = 26%.
