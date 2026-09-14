# Percentages — Complete Guide

## Table of Contents
1. [Concept](#1-concept)
2. [Shortcut / Trick](#2-shortcut--trick)
3. [Worked Examples](#3-worked-examples)
4. [Timed Practice Set](#4-timed-practice-set)

---

## 1. Concept

Percentage just means "per hundred" — 25% is another way of writing 25/100 or 0.25. Almost every quant section leans on percentages because they're the common language for profit/loss, discounts, interest, data interpretation, and even probability questions. The test rarely asks you to compute a percentage from scratch; it asks you to convert between percentage, fraction, and decimal instantly, and to chase a value through two or three percentage changes in a row without losing track of direction (increase vs. decrease).

The two skills this lesson builds are: (a) knowing common fraction-percentage equivalents cold, so "find 16.67% of 480" registers instantly as "that's 1/6 of 480 = 80" instead of a division you do by hand, and (b) handling **successive** percentage changes (a discount after a markup, a second discount on top of a first) without falling into the trap of just adding the percentages together.

**Plain-English example:** A shirt's price goes up 20% for the festive season, then gets a 20% "flat" discount in the sale. Most people guess the price is back to normal since +20% and −20% look like they cancel out. They don't — the discount is now computed on a *larger* base, so the shirt ends up 4% cheaper than the original price, not unchanged. That's exactly the kind of trap this lesson teaches you to see coming.

---

## 2. Shortcut / Trick

### Fraction ↔ percentage table (memorize this)

| Fraction | Percentage | Fraction | Percentage |
|---|---|---|---|
| 1/2 | 50% | 1/12 | 8.33% |
| 1/3 | 33.33% | 1/13 | 7.69% |
| 1/4 | 25% | 1/14 | 7.14% |
| 1/5 | 20% | 1/15 | 6.67% |
| 1/6 | 16.67% | 1/16 | 6.25% |
| 1/7 | 14.29% | 1/17 | 5.88% |
| 1/8 | 12.5% | 1/18 | 5.56% |
| 1/9 | 11.11% | 1/19 | 5.26% |
| 1/10 | 10% | 1/20 | 5% |
| 1/11 | 9.09% | | |

Once these are memorized, "find 33.33% of 240" becomes "1/3 of 240 = 80" — no long division.

### Percentage change formula

$$\%\text{ change} = \frac{\text{New value} - \text{Original value}}{\text{Original value}} \times 100$$

Positive result = increase, negative result = decrease.

### Successive percentage change shortcut

If a quantity changes by a% and then by b% (either can be negative, for a decrease), the **net single percentage change** is:

$$\text{Net }\% = a + b + \frac{ab}{100}$$

This works for any combination — two increases, two decreases, or one of each — as long as you plug in decreases as negative numbers. It replaces multiplying out (1 + a/100)(1 + b/100) step by step.

### Reverse percentage trick ("A is x% more than B")

If A is x% more than B, then B is **less** than A by:

$$\frac{x}{100 + x} \times 100 \, \%$$

(Not x% — that's the single most common percentage mistake in these tests. "20% more" and "20% less" are not mirror images of each other because the base changes.)

---

## 3. Worked Examples

### (a) Price increases 20%, then decreases 20% — net change?

a = 20, b = −20.

Net % = 20 + (−20) + (20 × −20)/100 = 0 + (−400/100) = 0 − 4 = **−4%**

So the final price is 4% *lower* than the original, not unchanged.

**Check directly:** Start at 100 → increase 20% → 120 → decrease 20% → 120 × 0.8 = 96. That's a 4% drop from 100. Matches.

### (b) Successive discounts of 10% and 15% on ₹2,000

a = −10, b = −15.

Net % = (−10) + (−15) + [(−10)(−15)/100] = −25 + 1.5 = **−23.5%**

Final price = 2000 × (1 − 0.235) = 2000 × 0.765 = **₹1,530**

**Check directly:** 2000 × 0.90 = 1800 (after 10% off) → 1800 × 0.85 = 1530 (after 15% off). Matches — and note it is *not* the same as a flat 25% discount (which would have given ₹1,500).

### (c) A's income is 25% more than B's. B's income is what % less than A's?

x = 25 (A is 25% more than B).

B is less than A by: 25/(100+25) × 100 = 25/125 × 100 = **20%**

**Check directly:** Let B = 100. Then A = 125. B is (125 − 100)/125 × 100 = 25/125 × 100 = 20% less than A. Matches — B is 20% less than A, *not* 25% less, even though A is 25% more than B.

---

## 4. Timed Practice Set

1. Convert 1/8 to a percentage. (20 sec)
2. What is 15% of 240? (30 sec)
3. A number, when increased by 30%, becomes 260. Find the original number. (45 sec)
4. A price is increased by 25% and then decreased by 20%. Find the net percentage change. (45 sec)
5. Successive discounts of 20% and 10% are offered on a ₹5,000 item. Find the final selling price. (45 sec)
6. A's salary is 20% more than B's. By what percentage is B's salary less than A's? (45 sec)
7. In an election with two candidates, the winner got 60% of the votes and won by a margin of 4,200 votes. Find the total number of votes cast. (60 sec)
8. The price of sugar rises by 25%. By what percentage must a household reduce its consumption to keep its total sugar expenditure unchanged? (45 sec)

### Answer Key

1. **12.5%** — 1/8 is a standard equivalent (memorize table).
2. **36** — 15% of 240 = 0.15 × 240 = 36.
3. **200** — x × 1.30 = 260 → x = 260/1.30 = 200.
4. **0% (no change)** — a=25, b=−20: net = 25 − 20 + (25×−20)/100 = 5 − 5 = 0%. Check: 100×1.25=125, 125×0.8=100 — back to the original value.
5. **₹3,600** — net = −20 −10 + (−20×−10)/100 = −30 + 2 = −28%; 5000×0.72 = 3600.
6. **16.67% (= 50/3 %)** — B is less than A by x/(100+x)×100 with x=20: 20/120×100 = 16.67%.
7. **21,000** — winning margin as % of total = 60% − 40% = 20%, so 20% of total = 4200 → total = 4200/0.20 = 21,000.
8. **20%** — this is the reverse-percentage formula: reduction needed = x/(100+x)×100 with x=25: 25/125×100 = 20%.
